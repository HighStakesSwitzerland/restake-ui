import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import moment from 'moment'

import ValidatorImage from './ValidatorImage'
import ValidatorLink from './ValidatorLink'
import AboutLedger from './AboutLedger';

import {
  Offcanvas,
  Tab,
  Nav,
  Button,
  Badge
} from 'react-bootstrap'
import { round } from 'mathjs'

import ValidatorStake from './ValidatorStake';
import ValidatorProfile from './ValidatorProfile';
import ValidatorCalculator from './ValidatorCalculator';

function ValidatorModal(props) {
  const { validator, delegations, operators, network, validators, grants } = props
  const navigate = useNavigate()
  const params = useParams();
  const [activeTab, setActiveTab] = useState(params.section || 'profile');
  const [registryData, setRegistryData] = useState({})
  const [lastExec, setLastExec] = useState()

  let operator
  if (operators && validator){
    operator = network.getOperator(validator.operator_address);
  }

  useEffect(() => {
    setLastExec()
  }, [validator]);

  useEffect(() => {
    setRegistryData()
  }, [validator?.path]);

  useEffect(() => {
    if(registryData == null){
      getRegistryData()
      const interval = setInterval(() => {
        getRegistryData()
      }, 15_000);
      return () => clearInterval(interval);
    }
  }, [validator, registryData]);

  useEffect(() => {
    if(lastExec == null){
      getLastExec(2)
      const interval = setInterval(() => {
        getLastExec()
      }, 60_000);
      return () => clearInterval(interval);
    }
  }, [operator, lastExec])

  useEffect(() => {
    if(params.network !== network.name) return

    const shouldShow = props.show && validator
    const shouldChangeValidator = params.validator !== validator?.operator_address
    const shouldChangeTab = activeTab === 'profile' ? !!params.section : params.section !== activeTab
    const shouldChangeUrl = shouldShow && (shouldChangeValidator || shouldChangeTab)
    if (shouldChangeUrl) {
      navigate(`/${network.name}/${validator.operator_address}${activeTab === 'profile' ? '' : `/${activeTab}`}`)
    } else if (params.validator && props.show === false) {
      navigate(`/${network.name}`)
    }
  }, [props.show, activeTab, validator])

  useEffect(() => {
    if (props.activeTab && props.activeTab != activeTab) {
      setTab(props.activeTab)
    } else if (params.section && params.section != activeTab) {
      const section = ['delegate', 'restake'].includes(params.section) ? 'stake' : params.section
      setTab(section)
    } else if (!activeTab || !props.show) {
      setTab('profile')
    }
  }, [props.show])

  function setTab(tab){
    setActiveTab(tab || 'profile')
  }

  function handleClose() {
    props.hideModal();
  }

  function getRegistryData(){
    if(validator?.path && network.directory){
      network.directory.getRegistryValidator(validator.path).then(data => {
        setRegistryData(data)
      })
    }else{
      setRegistryData({})
    }
  }

  function getLastExec(emptyResponseRetries) {
    if(!operator || !network.authzSupport || network.data.lastRestake === false){
      setLastExec()
      return
    }

    const key = network.chain.sdk50OrLater ? 'query' : 'events'

    network.restClient.getTransactions([
      // { key: key, value: `message.action='/cosmos.authz.v1beta1.MsgExec'` },
      { key: key, value: `message.sender='${operator.botAddress}'` }
    ], {
      pageSize: 3,
      order: 2,
      retries: 3,
      timeout: 15_000
    }).then(data => {
      if (data.tx_responses?.length > 0) {
        const lastExecResponse = data.tx_responses.find(tx => tx.tx.body.messages[0]['@type'] === '/cosmos.authz.v1beta1.MsgExec')
        if(lastExecResponse){
          setLastExec(moment(lastExecResponse.timestamp))
        }else{
          setLastExec(false)
        }
      } else if(emptyResponseRetries && lastExec == null) {
        getLastExec(emptyResponseRetries - 1)
      } else if(lastExec == null) {
        setLastExec(false)
      }
    }).catch(error => console.log(error))
  }

  return (
    <>
      <Offcanvas
        show={props.show}
        onHide={handleClose}
        placement="end"
        className="rs-inspector-drawer"
      >
        <Offcanvas.Header closeButton className="border-bottom py-3">
          {validator && (
            <div className="d-flex align-items-center gap-3 min-w-0 w-100 pe-2">
              <ValidatorImage validator={validator} width={40} height={40} />
              <div className="min-w-0 flex-grow-1">
                <div className="d-flex align-items-center gap-2">
                  <Offcanvas.Title className="fs-6 fw-semibold text-truncate mb-0">
                    <ValidatorLink validator={validator} />
                  </Offcanvas.Title>
                  {!validator.active && (
                    <Badge bg="danger-subtle" className="text-danger-emphasis border border-danger-subtle small">
                      {validator.jailed ? 'Jailed' : 'Inactive'}
                    </Badge>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2 small text-body-secondary tabular-nums mt-1">
                  <span>Rank #{validator.rank}</span>
                  <span>•</span>
                  <span>Fee {round((validator.commissionRate || 0) * 100, 2)}%</span>
                  {operator && (
                    <>
                      <span>•</span>
                      <span className="text-success fw-medium">REStake {operator.frequency()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </Offcanvas.Header>
        <Offcanvas.Body className="pt-3">
          {validator && (
            <Tab.Container activeKey={activeTab} onSelect={(k) => setTab(k)} id="validator-tabs">
              <Nav variant="pills" className="rs-nav-segmented w-100 mb-3 d-flex flex-nowrap overflow-auto">
                <Nav.Item className="flex-fill text-center">
                  <Nav.Link role="button" eventKey="stake" className="text-nowrap justify-content-center w-100">Stake & REStake</Nav.Link>
                </Nav.Item>
                <Nav.Item className="flex-fill text-center">
                  <Nav.Link role="button" eventKey="profile" className="text-nowrap justify-content-center w-100">Profile</Nav.Link>
                </Nav.Item>
                <Nav.Item className="flex-fill text-center">
                  <Nav.Link role="button" eventKey="calculator" className="text-nowrap justify-content-center w-100">Calculator</Nav.Link>
                </Nav.Item>
                {network.authzSupport && !network.authzAminoSupport && operator && (
                  <Nav.Item className="flex-fill text-center">
                    <Nav.Link role="button" eventKey="ledger" className="text-nowrap justify-content-center w-100">Ledger</Nav.Link>
                  </Nav.Item>
                )}
              </Nav>
              <Tab.Content>
                <Tab.Pane eventKey="profile">
                  <ValidatorProfile
                    theme={props.theme}
                    network={network}
                    networks={props.networks}
                    validator={validator}
                    operator={operator}
                    registryData={registryData}
                    lastExec={lastExec}
                    validatorApy={props.validatorApy} />
                </Tab.Pane>
                <Tab.Pane eventKey="stake">
                  <ValidatorStake
                    network={network}
                    validator={validator}
                    operator={operator}
                    lastExec={lastExec}
                    validators={validators}
                    operators={operators}
                    address={props.address}
                    wallet={props.wallet}
                    balance={props.balance}
                    delegations={delegations}
                    rewards={props.rewards}
                    grants={props.grants}
                    commission={props.commission}
                    validatorApy={props.validatorApy}
                    authzSupport={props.authzSupport}
                    restakePossible={props.restakePossible}
                    isLoading={props.isLoading}
                    onDelegate={props.onDelegate}
                    onClaimRewards={props.onClaimRewards}
                    onGrant={props.onGrant}
                    onRevoke={props.onRevoke}
                  />
                </Tab.Pane>
                <Tab.Pane eventKey="calculator">
                  <ValidatorCalculator
                    network={network}
                    validator={validator}
                    operator={operator}
                    delegation={delegations && delegations[validator.address]}
                  />
                </Tab.Pane>
                {network.authzSupport && !network.authzAminoSupport && operator && (
                  <Tab.Pane eventKey="ledger">
                    <AboutLedger network={network} validator={validator} modal={false} />
                  </Tab.Pane>
                )}
              </Tab.Content>
            </Tab.Container>
          )}
          {activeTab === 'profile' && (
            <div className="d-flex justify-content-end gap-2 border-top pt-3 mt-3">
              <Button variant="primary" size="sm" onClick={() => setTab('stake')}>
                Stake with {validator?.moniker}
              </Button>
            </div>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default ValidatorModal
