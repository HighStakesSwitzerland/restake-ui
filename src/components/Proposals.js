import React, { useState, useEffect } from 'react';
import Moment from 'react-moment';
import _ from 'lodash'

import {
  Table,
  Button,
  Badge,
} from 'react-bootstrap'
import { XCircle, ExclamationTriangle } from "react-bootstrap-icons";

import ProposalProgress from './ProposalProgress';
import TooltipIcon from './TooltipIcon';

function statusBadgeVariant(proposal) {
  if (proposal.isVoting) return { bg: 'primary-subtle', text: 'text-primary-emphasis border border-primary-subtle' };
  if (proposal.isDeposit) return { bg: 'warning-subtle', text: 'text-warning-emphasis border border-warning-subtle' };
  if (proposal.status === 'PROPOSAL_STATUS_PASSED') return { bg: 'success-subtle', text: 'text-success-emphasis border border-success-subtle' };
  if (proposal.status === 'PROPOSAL_STATUS_REJECTED' || proposal.status === 'PROPOSAL_STATUS_FAILED') {
    return { bg: 'danger-subtle', text: 'text-danger-emphasis border border-danger-subtle' };
  }
  return { bg: 'secondary-subtle', text: 'text-body border' };
}

function Proposals(props) {
  const { proposals, tallies, votes } = props

  function handleTitleKeyDown(event, proposal) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      props.showProposal(proposal);
    }
  }

  function renderProposal(proposal) {
    const proposalId = proposal.proposal_id
    const vote = votes[proposalId]
    const statusStyle = statusBadgeVariant(proposal);
    return (
      <tr key={proposalId} className={proposal.isSpam ? 'opacity-50' : ''}>
        <td className="d-none d-md-table-cell tabular-nums text-body-secondary">{proposalId}</td>
        <td>
          <div className="d-flex align-items-center">
            <span
              role="button"
              tabIndex={0}
              onClick={() => props.showProposal(proposal)}
              onKeyDown={(e) => handleTitleKeyDown(e, proposal)}
            >
              {proposal.title}
            </span>
            {proposal.isSpam && (
              <div className="ms-auto d-flex align-items-center text-danger">
                <TooltipIcon icon={<ExclamationTriangle />} identifier={proposalId} tooltip="This proposal appears to be spam - do not click any links!" />
              </div>
            )}
          </div>
        </td>
        <td className="d-none d-sm-table-cell text-center text-nowrap">
          <Badge bg={statusStyle.bg} className={`fw-medium ${statusStyle.text}`}>
            {proposal.statusHuman}
          </Badge>
        </td>
        <td className="d-none d-sm-table-cell text-center text-nowrap">
          <Moment fromNow>
            {proposal.isDeposit ? proposal.deposit_end_time : proposal.voting_end_time}
          </Moment>
        </td>
        <td className="text-center">
          {proposal.isVoting && (
            vote ? vote.optionHuman : <XCircle className="opacity-50" />
          )}
        </td>
        <td className="d-none d-md-table-cell text-center">
          <ProposalProgress
            proposal={proposal}
            tally={tallies[proposalId]} />
        </td>
        <td>
          <div className="d-grid gap-2 d-md-flex justify-content-end">
            <Button size="sm" variant={proposal.isSpam ? 'danger' : 'primary'} onClick={() => props.showProposal(proposal)}>
              View
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {proposals.length > 0 && (
        <div className="rs-table-wrapper">
          <Table hover className="align-middle mb-0">
            <thead>
              <tr>
                <th className="d-none d-md-table-cell tabular-nums">#</th>
                <th>Proposal</th>
                <th className="d-none d-sm-table-cell text-center">Status</th>
                <th className="d-none d-sm-table-cell text-center">End Time</th>
                <th className="text-center">Vote</th>
                <th className="d-none d-md-table-cell text-center">Progress</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(item => renderProposal(item))}
            </tbody>
          </Table>
        </div>
      )}
      {proposals.length < 1 &&
        <p className="text-center my-5"><em>No proposals found</em></p>
      }
    </>
  )
}

export default Proposals;
