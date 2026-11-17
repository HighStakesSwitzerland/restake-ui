import React, { useState, useEffect } from 'react';
import { larger, smaller, round } from 'mathjs'
import moment from 'moment'

import Select from 'react-select'
import {
  Table,
  Dropdown,
  Button,
  Spinner,
  Badge
} from 'react-bootstrap'
import { ChevronLeft, CheckCircle, XCircle, QuestionCircle, LightningChargeFill } from "react-bootstrap-icons";

import Coin from './Coin';
import TooltipIcon from './TooltipIcon'

import DelegateForm from './DelegateForm'
import { authzSupportMessage, rewardAmount } from '../utils/Helpers.mjs';
import ClaimRewards from './ClaimRewards';
import AlertMessage from './AlertMessage'
import REStakeGrantForm from './REStakeGrantForm';
import Address from './Address';
import OperatorLastRestake from './OperatorLastRestake';
import RevokeGrant from './RevokeGrant';
import ValidatorStatus from './ValidatorStatus'
import Coins from './Coins';

function ValidatorStake(props) {
  const { network, validator, operator, balance, wallet, address, lastExec } = props
  const [action, setAction] = useState(props.action)
  const [selectedValidator, setSelectedValidator] = useState();
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState()

  const delegation = props.delegations && props.delegations[validator.address]
  const validatorOperator = validator.isValidatorOperator(address)
  const validatorRewards = props.rewards && props.rewards[validator.address]
  const reward = rewardAmount(validatorRewards, network.denom)
  const validatorCommission = props.commission && props.commission[validator.address]
  const validatorGrants = props.grants && operator && props.grants[operator.botAddress]
  const { grantsValid, grantsExist, maxTokens, stakeGrant } = validatorGrants || {}

  useEffect(() => {
    setAction(props.action)
  }, [props.action])

  useEffect(() => {
    setError()
    props.onChangeAction && props.onChangeAction(action)
  }, [action])

  function actionText() {
    if (action === 'redelegate') {
      if (selectedValidator) {
        return `Redelegate to ${selectedValidator.moniker}`
      }
      return 'Redelegate to...'
    }
    if (action === 'undelegate') return `Undelegate from ${validator.moniker}`
    if (action === 'grant') return `${grantsValid ? 'Manage' : 'Enable'} ${validator.moniker} REStake`
    return `Delegate to  ${validator.moniker}`
  }

  function onDelegate() {
    setAction()
    props.onDelegate()
  }

  function onGrant(grantee, grant) {
    setAction()
    props.onGrant(grantee, grant)
  }

  function onRevoke(grantee, msgTypes) {
    setAction()
    props.onRevoke(grantee, msgTypes)
  }

  const minimumReward = () => {
    return {
      amount: operator.minimumReward,
      denom: network.denom
    }
  }

  function expiryDate() {
    const stakeExpiry = stakeGrant && stakeGrant.expiration && moment(stakeGrant.expiration)
    return stakeExpiry
  }

  function renderGrantStatus() {
    if (props.isLoading('grants')) {
      return (
        <Spinner animation="border" role="status" className="spinner-border-sm">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      )
    }
    if (grantsValid) {
      return <span><span className="text-success">Active</span><br /><small className="text-muted">expires {expiryDate().fromNow()}</small></span>
    }
    if (grantsExist) {
      if (validatorGrants.validators && !validatorGrants.validators.includes(validator.address)) {
        return <span className="text-danger">Grant invalid</span>
      }
      if (maxTokens && smaller(maxTokens, reward)) {
        return <span className="text-danger">Not enough grant remaining</span>
      }
      return <span className="text-danger">Invalid / total delegation reached</span>
    }
    return network.authzSupport ? <em>Inactive</em> : <em>Authz not supported</em>
  }

  function renderValidatorSelection() {
    return (
      <>
        <Validators
          modal={true}
          network={network}
          address={props.address}
          wallet={props.wallet}
          validators={props.validators}
          operators={props.operators}
          exclude={[validator.operator_address]}
          validatorApy={props.validatorApy}
          rewards={props.rewards}
          delegations={props.delegations}
          operatorGrants={props.grants}
          authzSupport={props.authzSupport}
          restakePossible={props.restakePossible}
          showValidator={setSelectedValidator}
          isLoading={props.isLoading}
          buttonText="Redelegate" />
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setAction()}>Cancel</Button>
        </div>
      </>
    )
  }

  function renderActionStep() {
    let content
    if (action === 'redelegate' && !selectedValidator) {
      content = renderValidatorSelection()
    } else if (action === 'grant') {
      content = (
        <REStakeGrantForm
          network={network}
          address={props.address}
          wallet={props.wallet}
          operator={operator}
          lastExec={lastExec}
          grants={validatorGrants}
          delegation={delegation}
          rewards={validatorRewards}
          validatorApy={props.validatorApy}
          authzSupport={props.authzSupport}
          restakePossible={props.restakePossible}
          closeForm={() => setAction()}
          onGrant={onGrant}
          onRevoke={onRevoke}
        />
      )
    } else {
      content = (
        <DelegateForm
          action={action}
          network={network}
          validator={validator}
          selectedValidator={selectedValidator}
          address={address}
          wallet={wallet}
          balance={balance}
          delegation={delegation}
          closeForm={() => setAction()}
          onDelegate={onDelegate} />
      )
    }

    return (
      <>
        <div className="d-flex align-items-center my-3">
          {action && (
            <ChevronLeft className="me-1" role="button" onClick={() => {
              action === 'redelegate' && selectedValidator ? setSelectedValidator() : setAction()
            }} />
          )}
          <h5 className="m-0">{actionText()}</h5>
        </div>
        {content}
      </>
    )
  }

  function renderStakeDetails() {
    return (
      <div className="row">
        <div className="col-12 col-lg-6 small mb-3">
          <Table>
            <tbody>
              {!validator.active && (
                <tr>
                  <td scope="row">Status</td>
                  <td><ValidatorStatus validator={validator} /></td>
                </tr>
              )}
              {network.apyEnabled && (
                <>
                  <tr>
                    <td scope="row">
                      APR
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <span>{round(validator.getAPR() * 100, 2).toLocaleString()}%</span>
                        <TooltipIcon
                          icon={<QuestionCircle className="ms-2" />}
                          identifier="delegations-apr"
                        >
                          <div className="mt-2 text-center">
                            <p>{round(network.chain.estimatedApr * 100, 2).toLocaleString()}% staking APR<br />- {validator.commissionRate * 100}% commission</p>
                            <p>Staking APR is calculated based on recent block time and is not guaranteed.</p>
                          </div>
                        </TooltipIcon>
                      </div>
                    </td>
                  </tr>
                  {operator && (
                    <tr>
                      <td scope="row">
                        APY
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span>{round(validator.getAPY(operator) * 100, 2).toLocaleString()}%</span>
                          <TooltipIcon
                            icon={<QuestionCircle className="ms-2" />}
                            identifier="delegations-apy"
                          >
                            <div className="mt-2 text-center">
                              <p>{round(validator.getAPR() * 100, 2).toLocaleString()}% APR compounded {operator.frequency(true)} by {validator.moniker}.</p>
                              <p>This is an estimate and best case scenario.</p>
                            </div>
                          </TooltipIcon>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )}
              {address && (
                <tr>
                  <td scope="row">Delegation</td>
                  <td className="text-break">
                    {!props.isLoading('delegations') ? (
                      <Coin
                        amount={delegation?.balance?.amount || 0}
                        denom={network.denom}
                        asset={network.baseAsset}
                        fullPrecision={true}
                      />
                    ) : (
                      <Spinner animation="border" role="status" className="spinner-border-sm">
                        <span className="visually-hidden">Loading...</span>
                      </Spinner>
                    )}
                  </td>
                </tr>
              )}
              {delegation?.balance?.amount && (
                <tr>
                  <td scope="row">Rewards</td>
                  <td>
                    {!props.isLoading('rewards') ? (
                      <Coins coins={validatorRewards?.reward} network={network} fullPrecision={true} />
                    ) : (
                      <Spinner animation="border" role="status" className="spinner-border-sm">
                        <span className="visually-hidden">Loading...</span>
                      </Spinner>
                    )}
                  </td>
                </tr>
              )}
              {validatorOperator && (
                <tr>
                  <td scope="row">Commission</td>
                  <td>
                    {!props.isLoading('commission') ? (
                      <Coins coins={validatorCommission?.commission} network={network} fullPrecision={true} />
                    ) : (
                      <Spinner animation="border" role="status" className="spinner-border-sm">
                        <span className="visually-hidden">Loading...</span>
                      </Spinner>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
        <div className="col-12 col-lg-6 small mb-3">
          <Table>
            <tbody>
              <tr>
                <td scope="row">REStake</td>
                <td>
                  {operator ? (
                    <TooltipIcon
                      icon={<CheckCircle className="text-success" />}
                      identifier={validator.operator_address}
                      tooltip="This validator can REStake your rewards"
                    />
                  ) : (
                    <TooltipIcon
                      icon={<XCircle className="opacity-50" />}
                      identifier={validator.operator_address}
                      tooltip={!network.restakeSupport ? "REStake is not supported at this time" : "This validator is not a REStake operator"}
                    />
                  )}
                </td>
              </tr>
              {operator && (
                <>
                  <tr>
                    <td scope="row">Frequency</td>
                    <td>
                      <span>{operator.runTimesString()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td scope="row">Minimum Reward</td>
                    <td>
                      <Coin {...minimumReward()} asset={network.baseAsset} fullPrecision={true} showValue={false} showImage={false} />
                    </td>
                  </tr>
                  {network.authzSupport && network.data.lastRestake !== false && (
                    <tr>
                      <td scope="row">Last REStake</td>
                      <td>
                        <OperatorLastRestake operator={operator} lastExec={lastExec} />
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td scope="row">REStake Address</td>
                    <td className="text-break"><Address address={operator.botAddress} /></td>
                  </tr>
                  {props.address && (
                    <>
                      <tr>
                        <td scope="row">Grant Status</td>
                        <td>{renderGrantStatus()}</td>
                      </tr>
                      {grantsExist && (
                        <tr>
                          <td scope="row">Grant Remaining</td>
                          <td className={!reward || maxTokens == null || larger(maxTokens, reward) ? 'text-success' : 'text-danger'}>
                            {maxTokens ? (
                              <Coin amount={maxTokens} denom={network.denom} asset={network.baseAsset} fullPrecision={true} showImage={false} />
                            ) : (
                              'Unlimited'
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </>
              )}
            </tbody>
          </Table>
        </div>
      </div>
    )
  }

  function renderManageDropdown() {
    if (!delegation?.balance?.amount || !wallet) return null

    if (loading) {
      return (
        <Button className="btn-sm btn-secondary" disabled>
          <span
            className="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          ></span>
          &nbsp;
        </Button>
      )
    }

    return (
      <Dropdown>
        <Dropdown.Toggle variant="secondary">
          Manage
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <ClaimRewards
            network={network}
            address={address}
            wallet={wallet}
            rewards={validatorRewards && [validatorRewards]}
            onClaimRewards={props.onClaimRewards}
            setLoading={(loading) => setLoading(loading)}
            setError={setError}
          />
          <ClaimRewards
            disabled={!validatorRewards || !rewardAmount(validatorRewards, network.denom)}
            restake={true}
            network={network}
            address={address}
            wallet={wallet}
            rewards={validatorRewards && [validatorRewards]}
            onClaimRewards={props.onClaimRewards}
            setLoading={(loading) => setLoading(loading)}
            setError={setError}
          />
          {validatorOperator && (
            <ClaimRewards
              commission={true}
              network={network}
              address={address}
              wallet={wallet}
              rewards={validatorRewards && [validatorRewards]}
              onClaimRewards={props.onClaimRewards}
              setLoading={(loading) => setLoading(loading)}
              setError={setError}
            />
          )}
          <hr />
          <Dropdown.Item as="button" disabled={!wallet?.hasPermission(address, 'BeginRedelegate')} onClick={() => {
            setSelectedValidator()
            setAction('redelegate')
          }}>
            Redelegate
          </Dropdown.Item>
          <Dropdown.Item as="button" disabled={!wallet?.hasPermission(address, 'Undelegate')} onClick={() => setAction('undelegate')}>
            Undelegate
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    )
  }

  function renderRestakeControl() {
    if (!operator) return null

    if (grantsValid) {
      return (
        <Dropdown>
          <Dropdown.Toggle
            variant="success"
            disabled={!props.restakePossible}
          >
            REStake
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item as="button" disabled={(!wallet?.hasPermission(address, 'Grant') && !wallet?.hasPermission(address, 'Revoke'))} onClick={() => {
              setAction('grant')
            }}>
              Manage Grant
            </Dropdown.Item>
            <RevokeGrant
              address={props.address}
              wallet={props.wallet}
              grantAddress={operator.botAddress}
              grants={[validatorGrants.stakeGrant, validatorGrants.claimGrant]}
              buttonText="Disable REStake"
              onRevoke={onRevoke}
              setLoading={(loading) => setLoading(loading)}
              setError={setError} />
          </Dropdown.Menu>
        </Dropdown>
      )
    }

    const enableTooltip = !network.authzSupport ? `${props.network.prettyName} doesn't support Authz just yet`
      : !wallet ? `Connect a wallet to enable REStake`
        : !wallet.authzSupport() ? authzSupportMessage(wallet)
          : !delegation?.balance?.amount ? `You must delegate to ${validator.moniker} before they can REStake for you.`
            : !wallet?.hasPermission(address, 'Grant') && `You don't have permission to do that.`

    return (
      <TooltipIcon
        icon={
          <div>
            <Button variant="success" disabled={!props.restakePossible || !delegation?.balance?.amount || !wallet?.hasPermission(address, 'Grant')} onClick={() => setAction('grant')}>
              Enable REStake
            </Button>
          </div>
        }
        identifier={validator.operator_address}
        tooltip={enableTooltip}
      />
    )
  }

  function renderActionMenu() {
    return (
      <div className="d-flex justify-content-end gap-2">
        {renderManageDropdown()}
        <TooltipIcon
          icon={
            <div>
              <Button variant="primary" disabled={!wallet?.hasPermission(address, 'Delegate')} onClick={() => setAction('delegate')}>
                Delegate
              </Button>
            </div>
          }
          identifier={validator.operator_address}
          tooltip={
            !wallet ? `Connect a wallet to delegate`
              : !wallet?.hasPermission(address, 'Delegate') && `You don't have permission to do that.`
          }
        />
        {renderRestakeControl()}
      </div>
    )
  }

  function renderRestakeHero() {
    if (!operator) return null;
    const apyBoost = network.apyEnabled && validator.getAPY && validator.getAPR
      ? round((validator.getAPY(operator) - validator.getAPR()) * 100, 2)
      : 0;

    return (
      <div className={`rs-restake-hero mb-3 ${grantsValid ? 'is-active' : ''}`}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <div className="d-flex align-items-center gap-2">
              <LightningChargeFill size={15} className={grantsValid ? 'text-success' : 'text-primary'} />
              <span className="fw-semibold small">
                {grantsValid ? 'REStake Auto-Compounding Active' : 'REStake Auto-Compounding'}
              </span>
              {apyBoost > 0 && (
                <Badge bg="success-subtle" className="text-success-emphasis border border-success-subtle small">
                  +{apyBoost}% APY boost
                </Badge>
              )}
            </div>
            <div className="small text-body-secondary mt-1">
              Compounds {operator.frequency()} • Min <Coin {...minimumReward()} asset={network.baseAsset} fullPrecision={true} showValue={false} showImage={false} /> • Validator pays fees
            </div>
          </div>
          {renderRestakeControl()}
        </div>
      </div>
    );
  }

  return (
    <>
      {error &&
        <AlertMessage variant="danger" dismissible={true}>
          {error}
        </AlertMessage>
      }
      {action ? renderActionStep() : (
        <>
          {renderRestakeHero()}
          {renderStakeDetails()}
          {renderActionMenu()}
        </>
      )}
    </>
  )
}

export default ValidatorStake
