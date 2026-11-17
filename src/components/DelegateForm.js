import React, { useState, useReducer } from 'react';
import moment from 'moment';

import {
  Button,
  Form,
} from 'react-bootstrap'

import { pow, multiply, divide, numeric, bignumber, format, round } from 'mathjs'

import AlertMessage from './AlertMessage'
import Coin from './Coin'
import { coin, execableMessage } from '../utils/Helpers.mjs'
import { MsgBeginRedelegate } from '../messages/MsgBeginRedelegate.mjs';
import { MsgUndelegate } from '../messages/MsgUndelegate.mjs';
import { MsgDelegate } from '../messages/MsgDelegate.mjs';
import { MsgGrant } from '../messages/MsgGrant.mjs';
import { StakeAuthorization } from '../messages/authorizations/StakeAuthorization.mjs';
import { GenericAuthorization } from '../messages/authorizations/GenericAuthorization.mjs';

function DelegateForm(props) {
  const { network, wallet, address, validator, selectedValidator, action, operator, restakePossible, grantsValid } = props
  const [state, setState] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    { amount: '', memo: '' }
  )
  const canBundleRestake = (!action || action === 'delegate') && operator && restakePossible && !grantsValid && wallet?.hasPermission(address, 'Grant');
  const [enableRestake, setEnableRestake] = useState(true);

  const asset = network.baseAsset
  let value
  if(state.amount && asset && asset.prices?.coingecko?.usd){
    value = numeric(multiply(state.amount, asset.prices.coingecko.usd), 'number')
  }

  const estimatedApy = operator && validator.getAPY
    ? validator.getAPY(operator)
    : validator.getAPR ? validator.getAPR() : 0;
  const estYearlyTokens = state.amount && estimatedApy
    ? numeric(multiply(state.amount, estimatedApy), 'number')
    : 0;

  function handleInputChange(event) {
    const target = event.target;
    const value = target.value;
    const name = target.name;

    setState({
      [name]: value
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setState({ loading: true, error: null })

    const amount = state.amount
    const memo = state.memo

    let denomAmount
    try {
      const decimals = pow(10, network.decimals)
      denomAmount = bignumber(multiply(bignumber(amount), decimals))
      if (!denomAmount.gt(0)) {
        setState({ loading: false, error: 'Amount must be greater than 0' })
        return
      }
      const available = availableBalance()?.amount
      if (available !== undefined && denomAmount.gt(bignumber(available))) {
        setState({ loading: false, error: 'Insufficient balance' })
        return
      }
    } catch {
      setState({ loading: false, error: 'Invalid amount' })
      return
    }

    const bundleGrant = canBundleRestake && enableRestake;
    let messages = buildMessages(denomAmount, bundleGrant)
    let gas
    try {
      gas = await wallet.simulate(messages)
    } catch (error) {
      console.log(error)
      setState({ loading: false, error: error.message })
      return
    }

    wallet.signAndBroadcast(messages, gas, memo).then((result) => {
      console.log("Successfully broadcasted:", result);
      if (bundleGrant && props.onGrant) {
        const expiry = moment().add(1, 'year');
        const genericGrantOnly = wallet.signAminoSupportOnly() && network.authzAminoGenericOnly;
        props.onGrant(operator.botAddress, {
          grantee: operator.botAddress,
          granter: address,
          expiration: expiry,
          authorization: genericGrantOnly ? {
            '@type': '/cosmos.authz.v1beta1.GenericAuthorization',
            msg: '/cosmos.staking.v1beta1.MsgDelegate'
          } : {
            '@type': '/cosmos.staking.v1beta1.StakeAuthorization',
            allow_list: { address: [operator.address] }
          }
        });
      }
      setState({ loading: false, error: null })
      props.onDelegate()
    }, (error) => {
      console.log('Failed to broadcast:', error)
      setState({ loading: false, error: `Failed to broadcast: ${error.message}` })
    })
  }

  function buildMessages(amount, bundleGrant) {
    const msgs = [];
    if (action === 'redelegate') {
      msgs.push(new MsgBeginRedelegate({
        delegatorAddress: address,
        validatorSrcAddress: validator.operator_address,
        validatorDstAddress: selectedValidator.operator_address,
        amount: coin(amount, network.denom)
      }))
    } else {
      const type = action === 'undelegate' ? MsgUndelegate : MsgDelegate
      msgs.push(new type({
        delegatorAddress: address,
        validatorAddress: validator.operator_address,
        amount: coin(amount, network.denom)
      }))
    }

    if (bundleGrant && operator) {
      const expiry = moment().add(1, 'year');
      const genericGrantOnly = wallet.signAminoSupportOnly() && network.authzAminoGenericOnly;
      const authorization = genericGrantOnly
        ? new GenericAuthorization({ msg: '/cosmos.staking.v1beta1.MsgDelegate' })
        : new StakeAuthorization({
            allowList: { address: [operator.address] },
            authorizationType: 1
          });
      msgs.push(new MsgGrant({
        granter: address,
        grantee: operator.botAddress,
        grant: {
          authorization,
          expiration: expiry.unix()
        }
      }));
    }

    return execableMessage(msgs.length === 1 ? msgs[0] : msgs, wallet.address, address)
  }

  function hasPermission() {
    const permission = action === 'redelegate' ? 'BeginRedelegate' : action === 'undelegate' ? 'Undelegate' : 'Delegate'
    return wallet?.hasPermission(address, permission)
  }

  function setPercentageAmount(fraction) {
    if (!wallet || !availableBalance()?.amount) return
    const decimals = pow(10, network.decimals)
    const total = bignumber(availableBalance().amount)
    const raw = divide(multiply(total, fraction), decimals)
    const formatted = round(raw, Math.min(network.decimals || 6, 6))
    setState({ amount: format(formatted, { notation: 'fixed' }) })
  }

  function availableBalance() {
    if (['redelegate', 'undelegate'].includes(action)) {
      return (props.delegation || {}).balance;
    } else {
      return props.balance;
    }
  }

  function actionText() {
    if (action === 'redelegate') return 'Redelegate'
    if (action === 'undelegate') return 'Undelegate'
    return canBundleRestake && enableRestake ? 'Delegate & Enable REStake' : 'Delegate'
  }

  function step() {
    return 1 / pow(10, network.decimals)
  }

  return (
    <>
      {!state.error && (selectedValidator?.active ?? validator?.active) === false &&
        <AlertMessage variant="info" dismissible={false}>
          {(selectedValidator || validator).moniker} is inactive - you will not receive any staking rewards until they are in the active set.
        </AlertMessage>
      }
      {state.error &&
        <AlertMessage variant="danger">
          {state.error}
        </AlertMessage>
      }
        <Form onSubmit={handleSubmit}>
          <fieldset disabled={!address || !wallet}>
            <Form.Group className="mb-3">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <Form.Label className="mb-0">Amount</Form.Label>
                {availableBalance() && (
                  <div className="d-flex align-items-center gap-1">
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        className="rs-chip-btn"
                        onClick={() => setPercentageAmount(pct)}
                      >
                        {pct === 1 ? 'Max' : `${pct * 100}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mb-2">
                <div className="input-group">
                  <Form.Control name="amount" type="number" min={0} step={step()} placeholder="10" required={true} value={state.amount} onChange={handleInputChange} />
                  <span className="input-group-text">{network.symbol}</span>
                </div>
                <div className="form-text d-flex justify-content-between tabular-nums">
                  <span className="value">
                    {value ? (
                      <em>${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</em>
                    ) : null}
                    {(!action || action === 'delegate') && estYearlyTokens > 0 && (
                      <span className="text-success ms-2 fw-medium">
                        +{estYearlyTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} {network.symbol}/yr
                      </span>
                    )}
                  </span>
                  {availableBalance() ? (
                    <span role="button" onClick={() => setPercentageAmount(1)}>
                      Available: <Coin {...availableBalance()} asset={asset} fullPrecision={true} showValue={false} showImage={false} />
                    </span>
                  ) : <span></span>}
                </div>
              </div>
            </Form.Group>

            {canBundleRestake && (
              <div className="rs-restake-hero is-active mb-3 p-2 px-3">
                <Form.Check
                  type="checkbox"
                  id="bundle-restake-checkbox"
                  checked={enableRestake}
                  onChange={(e) => setEnableRestake(e.target.checked)}
                  label={
                    <span className="small">
                      <strong>Also enable REStake auto-compounding</strong>
                      <span className="d-block text-body-secondary">
                        Authorizes {validator.moniker} to auto-compound rewards ({operator.frequency()}) in the same transaction.
                      </span>
                    </span>
                  }
                />
              </div>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Memo <span className="text-body-secondary small">(optional)</span></Form.Label>
              <Form.Control name="memo" as="textarea" rows={2} value={state.memo} onChange={handleInputChange} />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              {!state.loading
                ? (
                <>
                  {props.closeForm && (
                    <Button variant="secondary" onClick={props.closeForm}>Cancel</Button>
                  )}
                  <Button type="submit" disabled={!hasPermission()} className="btn btn-primary">{actionText()}</Button>
                </>
                ) : <Button className="btn btn-primary" type="button" disabled>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                </Button>
              }
            </div>
          </fieldset>
        </Form>
    </>
  )
}

export default DelegateForm
