import React, { useState, useEffect, useReducer } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'
import Moment from 'react-moment';

import {
  Spinner,
  Table,
  Nav,
  Button,
  Badge
} from 'react-bootstrap'
import { XCircle } from "react-bootstrap-icons";

import AlertMessage from './AlertMessage';
import RevokeGrant from './RevokeGrant';
import Coin from './Coin';
import GrantModal from './GrantModal';
import Favourite from './Favourite';
import Address from './Address'
import { authzSupportMessage } from '../utils/Helpers.mjs';

function formatAuthorizationType(type) {
  const raw = (type || '').split('.').slice(-1)[0];
  switch (raw) {
    case 'StakeAuthorization':
      return 'Stake Authorization';
    case 'GenericAuthorization':
      return 'Generic Authorization';
    case 'SendAuthorization':
      return 'Send Authorization';
    default:
      return raw.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Authorization';
  }
}

function Grants(props) {
  const { address, wallet, network, operators, validators, grants } = props
  const [error, setError] = useState()
  const [showModal, setShowModal] = useState()
  const [grantsLoading, setGrantLoading] = useReducer(
    (grantsLoading, newGrantsLoading) => ({...grantsLoading, ...newGrantsLoading}),
    {}
  )

  const [filter, setFilter] = useState({keywords: '', group: 'granter'})
  const [results, setResults] = useState([])

  const walletAuthzSupport = props.wallet?.authzSupport()

  useEffect(() => {
    if(!grants) return

    let filtered = filteredGrants(grants, filter)
    let group = filter.group
    while(filtered.length < 1 && group !== 'grantee'){
      group = 'grantee'
      filtered = filteredGrants(grants, {...filter, group})
      if(filtered.length > 0 || group === 'all'){
        return setFilter({ ...filter, group })
      }
    }
    setResults(filtered)
  }, [grants, filter]);

  function sortGrants(grants){
    return _.sortBy(grants, ({ expiration }) => {
      return new Date(expiration)
    });
  }

  function filterGrants(event){
    setFilter({...filter, keywords: event.target.value})
  }

  function filteredGrants(grants, filter){
    let searchResults = grants
    const { keywords, group } = filter

    searchResults = filterByGroup(searchResults, group)

    if (!keywords || keywords === '') return sortGrants(searchResults)

    const searcher = new FuzzySearch(
      searchResults, ['grantee', 'granter', 'authorization.@type', 'authorization.msg'],
      { sort: true }
    )

    return searcher.search(keywords)
  }

  function filterByGroup(grants, group){
    switch (group) {
      case 'grantee':
        grants = grants.grantee
        break;
      case 'granter':
        grants = grants.granter
        break;
    }
    return grants
  }

  function validatorForGrantAddress(grantAddress){
    const operator = operators.find(el => el.botAddress === grantAddress)
    if(!operator) return null

    return validators[operator.address]
  }

  function renderGrantData(grant){
    const maxTokens = grant.authorization.max_tokens
    switch (grant.authorization['@type']) {
      case "/cosmos.staking.v1beta1.StakeAuthorization":
        const restrictionType = grant.authorization.allow_list ? 'Validators' : 'Denied Validators'
        const restrictionList = grant.authorization.allow_list || grant.authorization.deny_list
        return (
          <small>
            Maximum: {maxTokens ? <Coin {...maxTokens} asset={network.baseAsset} fullPrecision={true} showValue={false} showImage={false} /> : 'unlimited'}<br />
            {restrictionType}: {restrictionList.address.map(address => {
              const validator = validators[address]
              return address ? <div key={address}>{validator?.moniker || <Address address={address} />}</div> : null
            })}
          </small>
        )
      case "/cosmos.authz.v1beta1.GenericAuthorization":
        return (
          <small>
            Message: {grant.authorization.msg.split('.').slice(-1)[0]}
          </small>
        )
    }
  }

  function closeModal(){
    setShowModal(false)
  }

  function onGrant(grantee, grant){
    setError(false)
    closeModal()
    props.onGrant(grantee, grant)
  }

  function onRevoke(grantee, msgTypes){
    setError(false)
    props.onRevoke(grantee, msgTypes)
  }

  function renderGrant(grant) {
    const { granter, grantee, authorization, expiration } = grant

    const validator = filter.group === 'granter' && validatorForGrantAddress(grant.grantee)
    const favourite = props.favouriteAddresses && props.favouriteAddresses.find(el => el.address === (filter.group === 'granter' ? grantee : granter))
    const grantId = `${granter}-${grantee}-${authorization['@type']}-${authorization.msg}`
    const expired = expiration && Date.parse(expiration) < Date.now()
    return (
      <tr key={grantId}>
        <td className="text-break">
          {filter.group === 'grantee' ? (
            <div className="d-flex">
              <Favourite
                value={props.favouriteAddresses.some(el => el['address'] === granter)}
                toggle={() => props.toggleFavouriteAddress(granter)}
                onTooltip="Remove saved address"
                offTooltip="Save address"
              />
              <span className="ps-2">{favourite?.label || <Address address={granter} />}</span>
            </div>
          ) : (
            validator ? validator.moniker : favourite?.label || <Address address={grantee} />
          )}
        </td>
        <td>
          <Badge bg="secondary-subtle" className="text-body border fw-medium">
            {formatAuthorizationType(authorization['@type'])}
          </Badge>
        </td>
        <td className="d-none d-lg-table-cell">
          {renderGrantData(grant)}
        </td>
        <td className="d-none d-md-table-cell">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className={expired ? 'text-danger' : ''}>
              <Moment format="LLL">
                {expiration}
              </Moment>
            </span>
            <Badge
              bg={expired ? 'danger-subtle' : 'success-subtle'}
              className={expired ? 'text-danger-emphasis border border-danger-subtle fw-medium' : 'text-success-emphasis border border-success-subtle fw-medium'}
            >
              {expired ? 'Expired' : 'Active'}
            </Badge>
          </div>
        </td>
        {filter.group === 'granter' && (
          <td>
            <div className="d-grid gap-2 d-md-flex justify-content-end">
              {!grantsLoading[grantId] ? (
                <RevokeGrant
                  address={address}
                  wallet={wallet}
                  grantAddress={grantee}
                  button={true}
                  size="sm"
                  grants={[grant]}
                  onRevoke={onRevoke}
                  setLoading={(loading) =>
                    setGrantLoading({ [grantId]: loading })
                  }
                  setError={setError}
                />
              ) : (
                <Button className="btn-sm btn-danger mr-5" disabled>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  &nbsp;
                </Button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  }

  if (!grants) {
    return (
      <div className="text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  const alerts = (
    <>
      {!props.grantQuerySupport && (
        <AlertMessage variant="warning">Grants cannot be queried on this network yet. <span role="button" className="text-decoration-underline" onClick={props.showFavouriteAddresses}>Save addresses</span> first to see their grants.</AlertMessage>
      )}
      {props.grantQuerySupport && !walletAuthzSupport && !!props.wallet && (
        <AlertMessage
          variant="warning"
          dismissible={false}
        >
          <p className="mb-0">{authzSupportMessage(props.wallet)}</p>
        </AlertMessage>
        )}
      <AlertMessage message={error} />
    </>
  );

  return (
    <>
      {alerts}
      <div className="mb-2">
        <div className="rs-toolbar d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="input-group w-auto flex-grow-1 flex-sm-grow-0" style={{ minWidth: '180px', maxWidth: '240px' }}>
            <input
              id="grant-search-input"
              className="form-control border-end-0"
              onChange={filterGrants}
              value={filter.keywords}
              type="text"
              placeholder="Search grants..."
              aria-label="Search grants"
            />
            <button
              className="btn btn-outline-secondary border-start-0"
              type="button"
              aria-label="Clear search"
              onClick={() => setFilter({ ...filter, keywords: '' })}
            >
              <XCircle />
            </button>
          </div>
          <Nav
            fill
            variant="pills"
            activeKey={filter.group}
            className={`flex-row${props.modal ? ' small' : ''}`}
            onSelect={(e) => setFilter({ ...filter, group: e })}
          >
            <Nav.Item>
              <Nav.Link eventKey="granter" disabled={filteredGrants(grants, { ...filter, group: 'granter' }).length < 1}>Granted by me</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="grantee" disabled={filteredGrants(grants, { ...filter, group: 'grantee' }).length < 1}>Granted to me</Nav.Link>
            </Nav.Item>
          </Nav>
          <div className="d-flex justify-content-end ms-auto ms-lg-0">
            <Button
              id="grant-new-btn"
              variant="primary"
              disabled={!wallet?.hasPermission(address, 'Grant')}
              onClick={() => setShowModal(true)}
            >
              {address && !!walletAuthzSupport ? 'New Grant' : 'CLI/Ledger Instructions'}
            </Button>
          </div>
        </div>
        {results.length > 0 && (
          <div className="rs-table-wrapper">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>{filter.group === 'grantee' ? 'Granter' : 'Grantee'}</th>
                  <th>Type</th>
                  <th className="d-none d-lg-table-cell">Data</th>
                  <th className="d-none d-md-table-cell">Expiration</th>
                  {filter.group === 'granter' && (
                    <th></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {results.map(item => renderGrant(item))}
              </tbody>
            </Table>
          </div>
        )}
        {results.length < 1 &&
          <p className="text-center my-5"><em>No grants found</em></p>
        }
      </div>
      <GrantModal
        show={showModal}
        network={props.network}
        address={props.address}
        wallet={props.wallet}
        favouriteAddresses={props.favouriteAddresses}
        onHide={closeModal}
        onGrant={onGrant}
      />
    </>
  );
}

export default Grants;
