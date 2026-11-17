import React from "react";
import _ from "lodash";
import { larger, largerEq, bignumber, add } from 'mathjs'
import AlertMessage from "./AlertMessage";
import ClaimRewards from "./ClaimRewards";
import ValidatorModal from "./ValidatorModal";
import AboutLedger from "./AboutLedger";

import {
  Button,
  Dropdown,
} from "react-bootstrap";
import { Gear } from "react-bootstrap-icons";

import { authzSupportMessage, parseGrants, rewardAmount } from "../utils/Helpers.mjs";
import Coin from "./Coin";
import Validators from "./Validators";

function filterDelegationsByValidators(delegations, validators) {
  const orderedAddresses = Object.keys(validators);
  return orderedAddresses.reduce((sum, address) => {
    if (delegations[address] && delegations[address].balance.amount !== '0') {
      sum[address] = delegations[address];
    }
    return sum;
  }, {});
}

function reduceRewardsByValidator(rewards) {
  return rewards.reduce((sum, reward) => {
    const validatorRewards = reward.reward.filter(el => largerEq(el.amount, 1));
    if (validatorRewards.length > 0) {
      sum[reward.validator_address] = {
        validator_address: reward.validator_address,
        reward: validatorRewards
      };
    }
    return sum;
  }, {});
}

function buildGrantData(grants, grantee, granter, validators) {
  const { claimGrant, stakeGrant } = parseGrants(grants, grantee, granter);
  let grantValidators, maxTokens;
  if (stakeGrant) {
    const { allow_list, deny_list, max_tokens } = stakeGrant.authorization;
    if (allow_list?.address) {
      grantValidators = allow_list.address;
    } else if (deny_list?.address) {
      grantValidators = deny_list.address.includes('')
        ? []
        : Object.values(validators).map(el => el.address).filter(address => !deny_list.address.includes(address));
    }
    maxTokens = max_tokens;
  }
  return {
    claimGrant,
    stakeGrant,
    validators: grantValidators,
    maxTokens: maxTokens ? bignumber(maxTokens.amount) : null
  };
}

function resolveOperatorGrants(operators, operatorGrants, rewards, denom, defaultGrant) {
  if (!operatorGrants) return {};
  return operators.reduce((sum, operator) => {
    const grant = operatorGrants[operator.botAddress] || defaultGrant;
    sum[operator.botAddress] = {
      ...grant,
      grantsValid: !!(
        grant.stakeGrant &&
        (!grant.validators || grant.validators.includes(operator.address)) &&
        (grant.maxTokens === null || larger(grant.maxTokens, rewardAmount(rewards?.[operator.address], denom)))
      ),
      grantsExist: !!(grant.claimGrant || grant.stakeGrant),
    };
    return sum;
  }, {});
}

function sumRewardsForValidators(rewards, denom, validators) {
  if (!rewards) return;

  const total = Object.values(rewards).reduce((sum, item) => {
    const reward = item.reward.find((el) => el.denom === denom);
    if (reward && (validators === undefined || validators.includes(item.validator_address))) {
      return add(sum, reward.amount);
    }
    return sum;
  }, 0);
  return {
    amount: total,
    denom: denom,
  };
}

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.state = { operatorGrants: {}, validatorLoading: {}, validatorApy: {}, validatorModal: {}, commission: {} };

    this.setError = this.setError.bind(this);
    this.setClaimLoading = this.setClaimLoading.bind(this);
    this.onClaimRewards = this.onClaimRewards.bind(this);
    this.onGrant = this.onGrant.bind(this);
    this.onRevoke = this.onRevoke.bind(this);
    this.isLoading = this.isLoading.bind(this);
    this.showValidatorModal = this.showValidatorModal.bind(this);
    this.setValidatorLoading = this.setValidatorLoading.bind(this);
    this.hideValidatorModal = this.hideValidatorModal.bind(this);
    this.defaultGrant = {
      claimGrant: null,
      stakeGrant: null,
      validators: [],
      grantsValid: false,
      grantsExist: false,
    }
  }

  async componentDidMount() {
    this.refresh(true);

    if (this.props.validator) {
      this.showValidatorModal(this.props.validator)
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    if (prevProps.validator !== this.props.validator && this.props.validator) {
      this.showValidatorModal(this.props.validator)
    }

    if ((this.props.network !== prevProps.network && !this.props.address)
      || (this.props.address !== prevProps.address)) {
      this.clearRefreshInterval()
      this.setState({
        delegations: undefined,
        rewards: undefined,
        commission: {},
        validatorApy: {},
        operatorGrants: {},
        error: null,
      });
      this.refresh(false);
    }

    if (this.props.grants !== prevProps.grants){
      this.getGrants()
    }
  }

  componentWillUnmount() {
    this.clearRefreshInterval()
  }

  restClient() {
    return this.props.network.restClient
  }

  async refresh(getGrants) {
    this.calculateApy();
    await this.getDelegations()
    if (getGrants){
      this.getGrants()
    }
    this.getRewards();
    this.refreshInterval();
  }

  refreshInterval() {
    const refreshInterval = setInterval(() => {
      this.getRewards(true);
    }, 15_000);
    const delegateInterval = setInterval(() => {
      this.getDelegations(true)
    }, 30_000)
    this.setState({ refreshInterval, delegateInterval });
  }

  clearRefreshInterval(){
    clearInterval(this.state.refreshInterval);
    clearInterval(this.state.delegateInterval);
  }

  async getDelegations(hideError) {
    if(!this.props.address) return
    const address = this.props.address

    return this.restClient().getDelegations(address)
      .then(
        (delegations) => {
          delegations = filterDelegationsByValidators(delegations, this.props.validators)
          if(address === this.props.address){
            this.setState({
              delegations: delegations,
              error: null
            });
          }
        },
        (error) => {
          if(address !== this.props.address) return

          if([404, 500].includes(error.response && error.response.status) && !this.state.delegations){
            this.setState({
              delegations: {},
              error: null
            });
          }else if(!hideError){
            this.setState({
              error: 'Failed to load delegations.',
            });
          }
        }
      )
  }

  getRewards(hideError) {
    if(!this.props.address) return

    this.restClient()
      .getRewards(this.props.address, this.props.network.denom)
      .then(
        (rewards) => {
          this.setState({ rewards: reduceRewardsByValidator(rewards) });
        },
        (error) => {
          if ([404, 500].includes(error.response && error.response.status) && !this.state.rewards) {
            this.setState({ rewards: {} });
          } else {
            if (!hideError)
              this.setState({ error: "Failed to get rewards." });
          }
        }
      );

    Object.values(this.props.validators).forEach(validator => {
      if(validator.isValidatorOperator(this.props.address)){
        this.restClient().getCommission(validator.address).then((commission) => {
          this.setState((state, props) => ({
            commission: _.set(
              state.commission,
              validator.address,
              { commission: commission.filter(comm => largerEq(comm.amount, 1)) }
            ),
          }));
        })
      }
    })
  }

  async calculateApy() {
    if (!this.props.network.apyEnabled || !this.props.network.getApy) return

    this.props.network.getApy(
      this.props.validators,
      this.props.operators
    ).then(validatorApy => {
      this.setState({ validatorApy });
    }, error => {
      console.log(error)
      this.setState({ error: "Failed to get APY." });
    })
  }

  async getGrants() {
    if (!this.props.grants?.granter) return

    const operatorGrants = this.props.operators.reduce((sum, operator) => {
      const grantee = operator.botAddress
      sum[grantee] = this.buildGrants(this.props.grants.granter, grantee, this.props.address)
      return sum
    }, {})
    this.setState({operatorGrants: operatorGrants})
  }

  buildGrants(grants, grantee, granter){
    return buildGrantData(grants, grantee, granter, this.props.validators);
  }

  isValidatorOperator(){
    if(!this.props.address) return false

    return Object.values(this.props.validators).some(validator => validator.isValidatorOperator(this.props.address))
  }

  isLoading(type){
    if(!this.props.address) return false
    const loaders = {
      'delegations': () => !this.state.delegations,
      'grants': () => this.props.network?.authzSupport && !this.props.grants?.granter,
      'rewards': () => !this.state.rewards,
      'commission': () => this.isValidatorOperator() && !this.state.commission
    }
    if(!type) return Object.values(loaders).some((value) => value())

    return loaders[type] ? loaders[type]() : false
  }

  onGrant(grantAddress, grant) {
    const operator = this.props.operators.find(el => el.botAddress === grantAddress)
    if(operator){
      this.setState((state, props) => ({
        error: null,
        validatorLoading: _.set(state.validatorLoading, operator.address, false),
      }));
    }
    this.props.onGrant(grantAddress, grant)
  }

  onRevoke(grantAddress, msgTypes) {
    const operator = this.props.operators.find(el => el.botAddress === grantAddress)
    if(operator){
      this.setState((state, props) => ({
        error: null,
        validatorLoading: _.set(state.validatorLoading, operator.address, false),
      }));
    }else{
      this.setState({ error: null });
    }
    this.props.onRevoke(grantAddress, msgTypes)
  }

  onClaimRewards() {
    this.setState({ claimLoading: false, validatorLoading: {}, error: null });
    setTimeout(() => {
      this.props.getBalance();
      this.getDelegations();
      this.getRewards();
    }, 3_000);
  }

  setClaimLoading(value) {
    if (value) this.setState({ error: null });
    this.setState({ claimLoading: !!value });
  }

  setValidatorLoading(validatorAddress, value) {
    if (value) this.setState({ error: null });
    this.setState((state, props) => ({
      validatorLoading: _.set(state.validatorLoading, validatorAddress, value),
    }));
  }

  setError(error) {
    this.setState({ error: error });
  }

  authzSupport() {
    return this.props.network.authzSupport
  }

  restakeSupport() {
    return this.authzSupport() && this.props.network.restakeSupport
  }

  operatorGrants() {
    return resolveOperatorGrants(
      this.props.operators,
      this.state.operatorGrants,
      this.state.rewards,
      this.props.network.denom,
      this.defaultGrant
    );
  }

  restakePossible() {
    return this.props.address && this.props.wallet?.authzSupport() && this.restakeSupport();
  }

  totalRewards(validators) {
    return sumRewardsForValidators(this.state.rewards, this.props.network.denom, validators);
  }

  totalStaked() {
    if (!this.state.delegations) return 0;
    return Object.values(this.state.delegations).reduce((sum, delegation) => {
      return add(sum, delegation?.balance?.amount || 0);
    }, 0);
  }

  showValidatorModal(validator, opts) {
    opts = opts || {}
    this.setState({ validatorModal: { show: true, validator: validator, ...opts } })
  }

  hideValidatorModal(opts) {
    opts = opts || {}
    this.setState((state, props) => {
      return { validatorModal: { ...state.validatorModal, show: false } }
    })
  }

  renderValidatorModal() {
    const validatorModal = this.state.validatorModal

    return (
      <ValidatorModal
        show={validatorModal.show}
        theme={this.props.theme}
        validator={validatorModal.validator}
        activeTab={validatorModal.activeTab}
        network={this.props.network}
        networks={this.props.networks}
        address={this.props.address}
        wallet={this.props.wallet}
        validators={this.props.validators}
        validatorApy={this.state.validatorApy}
        operators={this.props.operators}
        balance={this.props.balance}
        rewards={this.state.rewards}
        commission={this.state.commission}
        delegations={this.state.delegations || {}}
        grants={this.operatorGrants()}
        authzSupport={this.authzSupport()}
        restakePossible={this.restakePossible()}
        isLoading={this.isLoading}
        hideModal={this.hideValidatorModal}
        onDelegate={this.onClaimRewards}
        onGrant={this.onGrant}
        onRevoke={this.onRevoke}
        onClaimRewards={this.onClaimRewards}
        setError={this.setError}
      />
    )
  }

  restakeAlertProps() {
    if(!this.props.network.restakeAlert) return {}

    let props = { variant: 'info', dismissible: false }
    if(typeof this.props.network.restakeAlert === 'string'){
      props = { ...props, message: this.props.network.restakeAlert }
    }else{
      props = { ...props, ...this.props.network.restakeAlert }
    }
    return props
  }

  render() {
    if (!this.props.validators) {
      return (
        <div aria-busy="true" aria-label="Loading validators">
          {this.props.address && (
            <div className="row g-3 mb-4">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="col-12 col-md-4">
                  <div className="card h-100">
                    <div className="card-body py-3">
                      <div className="rs-skeleton mb-2" style={{ height: '0.75rem', width: '42%' }} />
                      <div className="rs-skeleton" style={{ height: '1.5rem', width: '65%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="rs-table-wrapper p-3">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div key={idx} className="d-flex align-items-center gap-3 py-2 border-bottom">
                <div className="rs-skeleton rounded-circle flex-shrink-0" style={{ width: 30, height: 30 }} />
                <div className="rs-skeleton flex-grow-1" style={{ height: '1.125rem' }} />
                <div className="rs-skeleton" style={{ height: '1.125rem', width: '80px' }} />
                <div className="rs-skeleton d-none d-sm-block" style={{ height: '1.125rem', width: '90px' }} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    const operatorGrants = this.operatorGrants();
    const delegatedOperators = this.props.operators.filter(
      (operator) => this.state.delegations?.[operator.address] && operatorGrants?.[operator.botAddress]?.grantsValid
    );
    const delegatedCount = Object.keys(this.state.delegations || {}).length;
    const totalRewards = this.totalRewards();
    const totalStaked = this.totalStaked();

    const alerts = (
      <>
        {this.props.network.restakeAlert && (
          <AlertMessage {...this.restakeAlertProps()} />
        )}
        {!this.authzSupport() && (
          <AlertMessage variant="info" dismissible={false}>
            {this.props.network.prettyName} doesn't support Authz just yet. You can stake and compound manually until support is added.
          </AlertMessage>
        )}
        {this.authzSupport() &&
          this.props.operators.length > 0 &&
          this.props.wallet &&
          !this.props.wallet.authzSupport() && (
            <>
              <AlertMessage
                variant="warning"
                dismissible={false}
              >
                <>
                  <p className="mb-0">{authzSupportMessage(this.props.wallet)}</p>
                </>
              </AlertMessage>
            </>
          )}
        <AlertMessage message={this.state.error} />
        {this.props.network && (
          <AboutLedger show={this.state.showAboutLedger} onHide={() => this.setState({ showAboutLedger: false })} network={this.props.network} />
        )}
      </>
    );

    const allRewardsDropdown = this.state.rewards && (
      !this.state.claimLoading && !this.isLoading('rewards') ? (
        <Dropdown>
          <Dropdown.Toggle
            variant="primary"
            size="sm"
            id="claim-dropdown"
          >
            All Rewards
          </Dropdown.Toggle>

          <Dropdown.Menu align="end">
            <ClaimRewards
              network={this.props.network}
              address={this.props.address}
              wallet={this.props.wallet}
              rewards={Object.values(this.state.rewards || {})}
              onClaimRewards={this.onClaimRewards}
              setLoading={this.setClaimLoading}
              setError={this.setError}
            />
            <ClaimRewards
              disabled={!totalRewards?.amount}
              restake={true}
              network={this.props.network}
              address={this.props.address}
              wallet={this.props.wallet}
              rewards={Object.values(this.state.rewards || {})}
              onClaimRewards={this.onClaimRewards}
              setLoading={this.setClaimLoading}
              setError={this.setError}
            />
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <Button variant="secondary" size="sm" disabled aria-label="Loading rewards actions">
          <span
            className="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          ></span>
          &nbsp;
        </Button>
      )
    );

    return (
      <>
        {alerts}
        {this.props.address && (
          <div className="row g-3 mb-4" aria-label="Staking portfolio summary">
            <div className="col-12 col-md-4">
              <div className="card h-100">
                <div className="card-body py-3">
                  <div className="text-body-secondary small text-uppercase fw-semibold mb-1">Total Staked</div>
                  {this.isLoading('delegations') ? (
                    <div className="rs-skeleton" style={{ height: '1.5rem', width: '60%' }} />
                  ) : (
                    <div className="fs-5 fw-semibold tabular-nums">
                      <Coin
                        amount={totalStaked}
                        denom={this.props.network.denom}
                        asset={this.props.network.baseAsset}
                        precision={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="card h-100">
                <div className="card-body py-3">
                  <div className="text-body-secondary small text-uppercase fw-semibold mb-1">Pending Rewards</div>
                  {this.isLoading('rewards') ? (
                    <div className="rs-skeleton" style={{ height: '1.5rem', width: '55%' }} />
                  ) : (
                    <div className="fs-5 fw-semibold tabular-nums">
                      <Coin
                        amount={totalRewards?.amount || 0}
                        denom={this.props.network.denom}
                        asset={this.props.network.baseAsset}
                        precision={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="card h-100">
                <div className="card-body py-3 d-flex align-items-center justify-content-between gap-2">
                  <div>
                    <div className="text-body-secondary small text-uppercase fw-semibold mb-1">REStake Status</div>
                    {this.isLoading('delegations') || this.isLoading('grants') ? (
                      <div className="rs-skeleton" style={{ height: '1.5rem', width: '110px' }} />
                    ) : (
                      <div className="fs-6 fw-semibold tabular-nums">
                        {this.restakeSupport()
                          ? `${delegatedOperators.length} / ${delegatedCount} Active`
                          : 'Manual Only'}
                      </div>
                    )}
                  </div>
                  {allRewardsDropdown}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mb-2">
          <Validators
            theme={this.props.theme}
            network={this.props.network}
            address={this.props.address}
            wallet={this.props.wallet}
            validators={this.props.validators}
            operators={this.props.operators}
            validatorApy={this.state.validatorApy}
            delegations={this.state.delegations}
            rewards={this.state.rewards}
            commission={this.state.commission}
            operatorGrants={operatorGrants}
            authzSupport={this.authzSupport()}
            restakePossible={this.restakePossible()}
            showValidator={this.showValidatorModal}
            isLoading={this.isLoading}
            setError={this.setError}
            onClaimRewards={this.onClaimRewards}
            onRevoke={this.onRevoke}
            manageControl={({validator, operator, delegation, rewards, grants, filter}) => {
              const { network, wallet, address } = this.props
              const validatorAddress = validator.operator_address
              const validatorOperator = validator.isValidatorOperator(address)
              return (
                !this.state.validatorLoading[validatorAddress] ? (
                  filter.group === 'delegated' && delegation ? (
                    <Dropdown>
                      <Dropdown.Toggle
                        variant="secondary"
                        size="sm"
                      >
                        <Gear />
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item as="button" onClick={() => this.showValidatorModal(validator, { activeTab: 'profile' })}>
                          View {validator.moniker}
                        </Dropdown.Item>
                        <hr />
                        <ClaimRewards
                          disabled={!rewards}
                          network={network}
                          address={address}
                          wallet={wallet}
                          rewards={[rewards]}
                          onClaimRewards={this.onClaimRewards}
                          setLoading={(loading) => this.setValidatorLoading(validatorAddress, loading)}
                          setError={this.setError}
                        />
                        <ClaimRewards
                          disabled={!rewards || !rewardAmount(rewards, network.denom)}
                          restake={true}
                          network={network}
                          address={address}
                          wallet={wallet}
                          rewards={[rewards]}
                          onClaimRewards={this.onClaimRewards}
                          setLoading={(loading) => this.setValidatorLoading(validatorAddress, loading)}
                          setError={this.setError}
                        />
                        {validatorOperator && (
                          <>
                            <hr />
                            <ClaimRewards
                              disabled={!rewards}
                              commission={true}
                              network={network}
                              address={address}
                              wallet={wallet}
                              rewards={[rewards]}
                              onClaimRewards={this.onClaimRewards}
                              setLoading={(loading) => this.setValidatorLoading(validatorAddress, loading)}
                              setError={this.setError}
                            />
                          </>
                        )}
                      </Dropdown.Menu>
                    </Dropdown>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => this.showValidatorModal(validator)}>
                      View
                    </Button>
                  )
                ) : (
                  <Button className="btn-sm btn-secondary" disabled>
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    &nbsp;
                  </Button>
                )
              )
            }} />
        </div>
        <hr className="my-4" />
        <div className="text-center mb-5">
          <p className="text-body-secondary mb-2">
            Enabling REStake authorizes the validator to send <em>Delegate</em> transactions on your behalf <a href="https://docs.cosmos.network/main/modules/authz/" target="_blank" rel="noopener noreferrer" className="text-reset">using Authz</a> for their own validator only. Revoke anytime.
          </p>
          <p className="mb-3">
            <strong>Validators pay the transaction fees for you.</strong>
          </p>
          <Button onClick={this.props.showAbout} variant="outline-secondary" size="sm">More info</Button>
        </div>
        {this.renderValidatorModal()}
      </>
    );
  }
}

export default Delegations;
