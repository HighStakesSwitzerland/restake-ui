import React, { useState, useEffect } from 'react';

import {
  Form,
  Button,
  Badge
} from 'react-bootstrap'
import { CheckCircleFill } from 'react-bootstrap-icons';

import Vote from '../utils/Vote.mjs';
import { MsgVote } from '../messages/MsgVote.mjs';
import { execableMessage } from '../utils/Helpers.mjs';

function VoteForm(props) {
  const { proposal, vote, wallet, granter, setError } = props
  const { proposal_id } = proposal

  const choices = [
    { key: 'VOTE_OPTION_YES', label: 'Yes', dotClass: 'bg-success' },
    { key: 'VOTE_OPTION_NO', label: 'No', dotClass: 'bg-danger' },
    { key: 'VOTE_OPTION_NO_WITH_VETO', label: 'No with Veto', dotClass: 'bg-warning' },
    { key: 'VOTE_OPTION_ABSTAIN', label: 'Abstain', dotClass: 'bg-secondary' }
  ]

  const [choice, setChoice] = useState(vote?.option)
  const [loading, setLoading] = useState()

  useEffect(() => {
    setChoice(vote?.option)
  }, [vote])

  function handleSubmit(event) {
    event.preventDefault();

    if (!choice) {
      return setError('Please choose an option')
    }

    setLoading(true)
    setError()

    const newVote = Vote({
      proposal_id: proposal_id,
      voter: granter || wallet.address,
      option: choice,
      options: [
        {
          choice,
          weight: "1.000000000000000000"
        }
      ]
    })

    const message = new MsgVote({
      proposalId: proposal.proposal_id,
      voter: newVote.voter,
      option: newVote.optionValue
    })

    wallet.signAndBroadcast(execableMessage(message, wallet.address, granter)).then((result) => {
      console.log("Successfully broadcasted:", result);
      setLoading(false)
      setError(null)
      props.onVote(proposal, newVote)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      setLoading(false)
      setError(error.message)
    })
  }

  const voteChanged = vote && vote.option !== choice

  function canVote() {
    if (!wallet?.address || !proposal.isVoting) return false
    if (!hasPermission()) return false

    return choice && (!vote || (vote && voteChanged))
  }

  function hasPermission(){
    return wallet && wallet.hasPermission(granter || wallet.address, 'Vote')
  }

  function buttonText() {
    if (!proposal.isVoting) return proposal.isDeposit ? 'Voting not started' : 'Voting ended'

    return vote ? voteChanged ? 'Change vote' : 'Voted' : 'Cast Vote'
  }

  const disabled = !proposal.isVoting || !hasPermission();

  return (
    <Form onSubmit={handleSubmit}>
      <div className="row g-2 my-2">
        {choices.map(({ key, label, dotClass }) => {
          const isSelected = key === choice;
          const isCurrentVote = vote && key === vote.option;
          return (
            <div key={key} className="col-6">
              <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setChoice(key)}
                className={`rs-choice-card ${isSelected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
              >
                <span className="d-flex align-items-center gap-2 text-truncate">
                  <span className={`rs-status-dot ${dotClass}`} />
                  <span>{label}</span>
                </span>
                {isCurrentVote ? (
                  <Badge bg="success-subtle" className="text-success-emphasis border border-success-subtle small">Voted</Badge>
                ) : isSelected ? (
                  <CheckCircleFill size={14} className="text-primary flex-shrink-0" />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
      <div className="text-end mt-3">
        {!loading
          ? (
            <Button type="submit" disabled={!canVote()} className="btn btn-primary">
              {buttonText()}
            </Button>
          ) : (
            <Button className="btn btn-primary" type="button" disabled>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
            </Button>
          )}
      </div>
    </Form>
  )
}

export default VoteForm
