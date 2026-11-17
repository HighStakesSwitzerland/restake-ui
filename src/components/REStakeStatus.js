import React from "react";
import _ from "lodash";
import TooltipIcon from "./TooltipIcon";

import {
  Spinner,
} from 'react-bootstrap'
import { XCircle, ToggleOn, ToggleOff } from "react-bootstrap-icons";
import { joinString } from "../utils/Helpers.mjs";
import Coin from "./Coin";

function REStakeStatus(props) {
  const { network, validator, operator, delegation, grants, authzSupport, className } = props

  const minimumReward = operator && {
    amount: operator.minimumReward,
    denom: network.denom,
  };

  let content, icon, tooltip
  let pillClass = 'bg-secondary-subtle text-body border'
  if(operator){
    let tooltipContent
    if(authzSupport){
      if(delegation){
        if(grants?.grantsValid){
          let limit
          if(grants.maxTokens){
            limit = <span><br />(<Coin amount={grants.maxTokens} denom={network.denom} asset={network.baseAsset} fullPrecision={true} showValue={false} showImage={false} /> remaining)</span>
          }else{
            limit = '(no limit)'
          }
          tooltipContent = <span>Grant active {limit}</span>
          pillClass = 'bg-success-subtle text-success-emphasis border border-success-subtle'
          icon = <ToggleOn className="flex-shrink-0" />
        }else if(grants?.grantsExist){
          tooltipContent = 'Update grants to enable REStake'
          pillClass = 'bg-danger-subtle text-danger-emphasis border border-danger-subtle'
          icon = <ToggleOff className="flex-shrink-0" />
        }else{
          tooltipContent = 'Grant to enable REStake'
          pillClass = 'bg-secondary-subtle text-body border'
          icon = <ToggleOff className="flex-shrink-0 text-body-secondary" />
        }
      }else{
        tooltipContent = 'Delegate to enable REStake'
      }
    }else{
      tooltipContent = `Enable REStake once ${network.prettyName} supports Authz`
    }
    if(props.isLoading('grants')) icon = (
      <Spinner animation="border" role="status" className="spinner-border-sm">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    )
    content = (
      <span className={joinString('rs-status-pill d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill text-nowrap small fw-medium', pillClass, className)}>
        {icon}
        <span>{operator.frequency()}</span>
      </span>
    )
    tooltip = (
      <div className="mt-2 text-center">
        <p>REStakes {operator.runTimesString()}</p>
        <p>
          Minimum reward is{" "}
          <Coin
            {...minimumReward}
            asset={network.baseAsset}
            fullPrecision={true}
            showValue={false}
            showImage={false}
          />
        </p>
        <p>{tooltipContent}</p>
      </div>
    )
  }else{
    content = (
      <span
        className={joinString('rs-status-pill d-inline-flex align-items-center justify-content-center px-2 py-1 rounded-pill bg-secondary-subtle text-body-secondary opacity-75 small', className)}
        aria-label="Not a REStake operator"
      >
        <XCircle />
      </span>
    )
    tooltip = !network.restakeSupport ? "REStake is not supported at this time" : "This validator is not a REStake operator"
  }

  function handleKeyDown(event) {
    if (!props.onClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      props.onClick(event)
    }
  }

  return (
    <span
      role={props.onClick ? 'button' : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      onClick={props.onClick}
      onKeyDown={props.onClick ? handleKeyDown : undefined}
    >
      <TooltipIcon
        icon={content}
        identifier={validator.operator_address}
        rootClose={true}
        tooltip={tooltip}
      />
    </span>
  )
}

export default REStakeStatus
