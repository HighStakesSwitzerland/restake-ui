import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React from 'react'
import _ from 'lodash'
import AlertMessage from './AlertMessage'
import NetworkSelect from './NetworkSelect'
import Delegations from './Delegations';
import Coin from './Coin'
import About from './About'

import {
  Container,
  Dropdown,
  ButtonGroup,
  Navbar,
  Nav,
  Spinner
} from 'react-bootstrap';
import {
  Sun,
  Moon,
  CircleHalf,
  CashCoin,
  Coin as CoinIcon,
  EnvelopePaper,
  Stars,
  WrenchAdjustableCircleFill,
  Globe,
  Magic,
  Clipboard,
  ClipboardCheck,
  Eye,
  Key,
  CurrencyExchange
} from 'react-bootstrap-icons'
import { CopyToClipboard } from 'react-copy-to-clipboard';
import GitHubButton from 'react-github-btn'
import { Cosmiframe } from '@dao-dao/cosmiframe'
import Logo from '../assets/logo.png'
import Logo2x from '../assets/logo@2x.png'
import Logo3x from '../assets/logo@3x.png'
import LogoWhite from '../assets/logo-white.png'
import LogoWhite2x from '../assets/logo-white@2x.png'
import LogoWhite3x from '../assets/logo-white@3x.png'

import PoweredByAkash from '../assets/powered-by-akash.svg'
import PoweredByAkashWhite from '../assets/powered-by-akash-white.svg'
import TooltipIcon from './TooltipIcon';
import Voting from './Voting';
import Networks from './Networks';
import Grants from './Grants';
import Swap from './Swap';
import Favourite from './Favourite';
import WalletModal from './WalletModal';
import Wallet from '../utils/Wallet.mjs';
import SendModal from './SendModal';
import KeplrSignerProvider from '../utils/KeplrSignerProvider.mjs';
import LeapSignerProvider from '../utils/LeapSignerProvider.mjs';
import CosmiframeSignerProvider from '../utils/CosmiframeSignerProvider.mjs';
import { truncateAddress } from '../utils/Helpers.mjs';
import CosmostationSignerProvider from '../utils/CosmostationSignerProvider.mjs';

class App extends React.Component {
  constructor(props) {
    super(props);
    const favouriteJson = localStorage.getItem('favourites')
    const favouriteAddressJson = localStorage.getItem('favourite-addresses')
    this.state = {
      favourites: favouriteJson ? JSON.parse(favouriteJson) : [],
      favouriteAddresses: favouriteAddressJson ? JSON.parse(favouriteAddressJson) : {}
    }
    this.signerProviders = [
      new KeplrSignerProvider(window.keplr),
      new LeapSignerProvider(window.leap),
      new CosmostationSignerProvider(window.cosmostation?.providers?.keplr, window.cosmostation?.cosmos),
      new CosmiframeSignerProvider(new Cosmiframe(["https://daodao.zone", "https://dao.daodao.zone"]))
    ]
    this.signerConnectors = {}
    this.connectAuto = this.connectAuto.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.showNetworkSelect = this.showNetworkSelect.bind(this);
    this.getBalance = this.getBalance.bind(this);
    this.onSend = this.onSend.bind(this);
    this.onGrant = this.onGrant.bind(this);
    this.onRevoke = this.onRevoke.bind(this);
    this.toggleFavourite = this.toggleFavourite.bind(this);
    this.toggleFavouriteAddress = this.toggleFavouriteAddress.bind(this);
    this.updateFavouriteAddresses = this.updateFavouriteAddresses.bind(this);
  }

  async componentDidMount() {
    this.connect()
    window.addEventListener("load", this.connectAuto)
    const disabledWallets = this.props.network?.disabledWallets || []
    this.signerProviders.forEach(provider => {
      if(disabledWallets.includes(provider.name)) return

      const connector = (event) => this.connectAuto(event, provider.name)
      this.signerConnectors[provider.name] = connector
      window.addEventListener(provider.keychangeEvent, connector)
    })
  }

  async componentDidUpdate(prevProps, prevState) {
    if (!this.props.network) return

    if (this.props.network !== prevProps.network) {
      this.clearRefreshInterval()
      this.setState({ balance: undefined, address: undefined, wallet: undefined, grants: undefined, error: undefined })
      this.connect()
    }else if(this.state.address != prevState.address){
      this.clearRefreshInterval()
      this.setState({ balance: undefined, grants: undefined, error: undefined })
      this.getBalance()
      this.getGrants().then(() => {
        this.refreshInterval();
      })
    }
  }

  componentWillUnmount() {
    this.clearRefreshInterval()
    window.removeEventListener("load", this.connectAuto)
    const disabledWallets = this.props.network?.disabledWallets || []
    this.signerProviders.forEach(provider => {
      if(disabledWallets.includes(provider.name)) return

      window.removeEventListener(provider.keychangeEvent, this.signerConnectors[provider.name])
    })
  }

  showNetworkSelect() {
    this.setState({ showNetworkSelect: true })
  }

  connected() {
    return this.props.network?.connected
  }

  restClient() {
    return this.props.network?.restClient
  }

  getSignerProvider(providerKey){
    if(this.props.network?.disabledWallets?.includes(providerKey)) return

    return providerKey && this.signerProviders.find(el => el.name === providerKey)
  }

  disconnect() {
    localStorage.removeItem('connected')
    this.state.wallet?.disconnect()
    this.setState({
      error: null,
      address: null,
      balance: null,
      wallet: null
    })
  }

  connectAuto(event, providerKey){
    return this.connect(providerKey)
  }

  async connect(providerKey, manual) {
    if (this.props.network && !this.connected()) {
      return this.setState({
        error: 'Could not connect to any available API servers'
      })
    }

    let storedKey = localStorage.getItem('connected')
    if(storedKey === '1'){ // deprecate
      storedKey = 'keplr'
      localStorage.setItem('connected', storedKey)
    }

    let signerProvider = this.getSignerProvider(providerKey || storedKey)

    await Promise.all(this.signerProviders.map(async provider => {
      const connected = await provider.autoconnect();
      if (connected && !signerProvider) {
        signerProvider = provider;
        manual = true;
      }
    }))

    if(!signerProvider) return

    providerKey = signerProvider.name

    if (manual && !signerProvider.available()) {
      return this.setState({
        providerError: providerKey
      })
    }

    const { network } = this.props
    if (!network || !signerProvider.available()) return

    if (!manual && providerKey !== storedKey) {
      return
    }

    const wallet = new Wallet(network, signerProvider)
    try {
      const key = await wallet.connect();
      if (!network.ledgerSupport && (key.isNanoLedger || key.isHardware)) {
        throw new Error('Ledger support is coming soon')
      }
    } catch (e) {
      return this.setState({
        error: `Unable to connect to ${signerProvider?.label || 'signer'}: ${e?.message}`,
        address: null,
        wallet: null,
      })
    }
    const address = wallet.address;
    localStorage.setItem('connected', providerKey)
    this.setState({
      address,
      wallet,
      error: false
    })
  }

  refreshInterval() {
    const balanceInterval = setInterval(() => {
      this.getBalance();
    }, 15_000);

    this.setState({ refresh: true, balanceInterval })
    this.refreshTimeout()
  }

  refreshTimeout() {
    if(!this.state.refresh) return

    const grantTimeout = setTimeout(() => {
      this.getGrants().then(() => {
        this.refreshTimeout()
      });
    }, 60_000);
    this.setState({ grantTimeout });
  }

  clearRefreshInterval() {
    clearTimeout(this.state.grantTimeout);
    clearInterval(this.state.balanceInterval);
    this.setState({ refresh: false })
  }

  toggleFavourite(network) {
    const { favourites } = this.state
    let newFavourites
    if (favourites.includes(network.path)) {
      newFavourites = favourites.filter(el => el !== network.path)
    } else {
      newFavourites = [...favourites, network.path]
    }
    localStorage.setItem('favourites', JSON.stringify(newFavourites))
    this.setState({ favourites: newFavourites })
  }

  toggleFavouriteAddress(address, label) {
    const favourites = this.favouriteAddresses()
    let newFavourites
    if (favourites.some(el => el.address === address)) {
      newFavourites = favourites.filter(el => el.address !== address)
    } else {
      newFavourites = [...favourites, { address, label }]
    }
    this.updateFavouriteAddresses({ ...this.state.favouriteAddresses, [this.props.network.path]: newFavourites })
  }

  updateFavouriteAddresses(newFavourites) {
    localStorage.setItem('favourite-addresses', JSON.stringify(newFavourites))
    this.setState({ favouriteAddresses: newFavourites })
  }

  favouriteAddresses(){
    return this.state.favouriteAddresses[this.props.network.path] || []
  }

  currentFavouriteAddress(){
    return this.favouriteAddresses().find(el => el.address === this.state.address)
  }

  otherFavouriteAddresses() {
    return this.favouriteAddresses().filter(el => el.address !== this.state.wallet?.address)
  }

  viewingWallet() {
    return this.state.address && this.state.address === this.state.wallet?.address
  }

  addressName() {
    if(!this.state.address) return null

    if(this.viewingWallet()) return this.state.wallet.name
    return this.currentFavouriteAddress()?.label || this.state.address
  }

  async getBalance() {
    if (!this.state.address) return

    return this.restClient().getBalance(this.state.address)
      .then(
        (balances) => {
          balances = _.compact(balances || [])
          const balance = balances.find(
            (element) => element.denom === this.props.network.denom
          ) || { denom: this.props.network.denom, amount: 0 };
          this.setState({
            balance,
            balances,
            error: null
          })
        },
        (error) => console.log(error)
      )
  }

  async getGrants() {
    if (!this.state.address || !this.props.network.authzSupport) return
    const address = this.state.address
    let granterGrants, granteeGrants, grantQuerySupport

    try {
      granterGrants = await this.restClient().getGranterGrants(address)
      this.setGrants(address, granterGrants, 'granter', true)
      granteeGrants = await this.restClient().getGranteeGrants(address)
      return this.setGrants(address, granteeGrants, 'grantee')
    } catch (error) {
      console.log('Failed to get all grants in batch', error.message)
      grantQuerySupport = error.response?.status !== 501
      this.setState((state) => {
        if (address !== state.address) return {}
        return { grantQuerySupport }
      })
      if(grantQuerySupport){
        return this.setState({ error: "Failed to load all grants" })
      }
    }

    let addresses = this.props.operators.map(el => el.botAddress)
    const favourites = this.favouriteAddresses()
    addresses = addresses.concat(favourites.filter(el => !addresses.includes(el.address)).map(el => el.address))

    granterGrants = await this.getGrantsIndividually(addresses.map(el => {
      return { grantee: el, granter: address }
    }))
    this.setGrants(address, granterGrants, 'granter', grantQuerySupport)
    granteeGrants = await this.getGrantsIndividually(favourites.map(el => {
      return { granter: el.address, grantee: address }
    }))
    this.setGrants(address, granteeGrants, 'grantee', grantQuerySupport)
  }

  async getGrantsIndividually(grants){
    const address = this.state.address
    const calls = grants.map(({granter, grantee}) => {
      return () => {
        if (address !== this.state.address) return

        return this.restClient().getGrants(grantee, granter).then(
          (result) => {
            return result.map(grant => {
              return {
                ...grant,
                grantee,
                granter
              }
            })
          });
      }
    });

    const batchCalls = _.chunk(calls, 5);

    let allGrants = []
    for (const batchCall of batchCalls) {
      if (address !== this.state.address) return
      const grants = (await Promise.allSettled(batchCall.map(call => call()))).map(el => el.status === 'fulfilled' && el.value)
      allGrants = allGrants.concat(_.compact(grants.flat()))
    }
    return allGrants
  }

  setGrants(address, grants, type, grantQuerySupport){
    if(type === 'grantee' && this.state.wallet?.address === address){
      this.state.wallet.grants = grants || []
    }
    if (address !== this.state.address) return
    this.setState((state) => {
      if (address !== state.address) return {}
      return {
        grants: {
          ...state.grants,
          [type]: grants,
        },
        grantQuerySupport: grantQuerySupport ?? state.grantQuerySupport
      }
    })
  }

  onSend(recipient, amount){
    this.setState({showSendModal: false})
    setTimeout(() => {
      this.getBalance()
    }, 2_000);
  }

  onGrant(grantee, grant) {
    const filterGrant = (el) => {
      if (el.grantee !== grantee) return true
      if (el.authorization['@type'] === grant.authorization['@type'] && el.authorization.msg === grant.authorization.msg) {
        return false
      }
      return true
    }
    this.setState((state, props) => {
      if(!state.grants) return {}

      const granterGrants = state.grants.granter?.filter(filterGrant) || []
      granterGrants.push(grant)
      return { grants: { ...state.grants, granter: granterGrants } }
    })
    if(this.state.wallet && grantee === this.state.wallet.address){
      const grants = this.state.wallet.grants.filter(filterGrant)
      grants.push(grant)
      this.state.wallet.grants = grants
    }
  }

  onRevoke(grantee, msgTypes) {
    const filterGrant = (el) => {
      if (el.grantee !== grantee) return true
      if (msgTypes.includes('/cosmos.staking.v1beta1.MsgDelegate')) {
        if (el.authorization['@type'] === '/cosmos.staking.v1beta1.StakeAuthorization') return false
      }
      if (el.authorization['@type'] === '/cosmos.authz.v1beta1.GenericAuthorization' && msgTypes.includes(el.authorization.msg)) return false
      return true;
    }
    this.setState((state, props) => {
      if(!state.grants || !state.grants.granter) return {}

      const granterGrants = state.grants.granter.filter(filterGrant)
      return { grants: { ...state.grants, granter: granterGrants } }
    })
    if(this.state.wallet && grantee === this.state.wallet.address){
      this.state.wallet.grants = this.state.wallet.grants.filter(filterGrant)
    }
  }

  showWalletModal(opts) {
    this.setState((state) => ({
      walletModal: {
        ...state.walletModal,
        ...opts,
        show: true
      }
    }))
  }

  hideWalletModal(opts) {
    opts = opts || {}
    this.setState((state) => {
      return { walletModal: { ...state.walletModal, show: false } }
    })
  }

  setCopied() {
    this.setState({ copied: true })
    setTimeout(() => {
      this.setState({ copied: false })
    }, 2000)
  }

  themeIcon() {
    const { theme, themeChoice, themeDefault, setThemeChoice } = this.props
    let icon, switchTo
    let iconProps = {
      size: '1.25em',
      className: 'me-2 me-md-3',
      role: 'button',
      tabIndex: 0,
      onClick: () => setThemeChoice(switchTo),
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setThemeChoice(switchTo)
        }
      }
    }
    if (themeChoice === 'auto') {
      icon = <CircleHalf {...iconProps} aria-label="Theme: Auto" />
      switchTo = theme === 'dark' ? 'light' : 'dark'
    } else {
      icon = themeChoice === 'dark'
        ? <Moon {...iconProps} aria-label="Theme: Dark" />
        : <Sun {...iconProps} aria-label="Theme: Light" />
      switchTo = themeDefault !== theme ? 'auto' : theme === 'dark' ? 'light' : 'dark'
    }
    const tooltip = `Switch to ${switchTo} mode`
    return (
      <span className="d-inline-flex align-items-center">
        <TooltipIcon icon={icon} tooltip={tooltip} placement="left" rootClose={true} />
      </span>
    )
  }

  networkIcon() {
    const isTestnet = this.props.directory.testnet
    const mode = isTestnet ? 'mainnet' : 'testnet'
    const tooltip = `Switch to ${mode}`
    const pill = (
      <button
        type="button"
        id="network-mode-toggle"
        onClick={() => this.props.changeNetworkMode(mode)}
        className={`btn btn-sm rounded-pill d-inline-flex align-items-center gap-1 me-2 me-md-3 ${
          isTestnet
            ? 'btn-outline-warning text-warning-emphasis bg-warning-subtle border-warning-subtle'
            : 'btn-outline-secondary text-body-secondary'
        }`}
        aria-label={tooltip}
      >
        {isTestnet ? <WrenchAdjustableCircleFill size={13} /> : <Globe size={13} />}
        <span className="small fw-medium">{isTestnet ? 'Testnet' : 'Mainnet'}</span>
      </button>
    )
    return (
      <span className="text-reset d-inline-flex align-items-center">
        <TooltipIcon icon={pill} tooltip={tooltip} placement="left" />
      </span>
    )
  }

  pageTitle() {
    const networkName = this.props.network?.prettyName
    switch (this.props.active) {
      case 'networks':
        return 'Explore Networks'
      case 'voting':
        return networkName ? `${networkName} Governance` : 'Governance'
      case 'grants':
        return networkName ? `${networkName} Authz Grants` : 'Authz Grants'
      case 'swap':
        return networkName ? `Swap on ${networkName}` : 'Swap'
      case 'delegations':
      default:
        return networkName ? `${networkName} Staking` : 'Staking'
    }
  }

  introText(){
    switch (this.props.active) {
      case 'networks':
        return <span>REStake automatically imports <a href="https://cosmos.network/" target="_blank" rel="noopener noreferrer" className="text-reset"><strong>Cosmos</strong></a> chains from the <a href="https://github.com/cosmos/chain-registry" target="_blank" rel="noopener noreferrer" className="text-reset"><strong>Chain Registry</strong></a></span>
      case 'voting':
        return <span>REStake let's you vote on behalf of your other {this.props.network && <strong onClick={this.showNetworkSelect} className="text-decoration-underline text-nowrap" role="button">{this.props.network.prettyName}</strong>} wallets using Authz</span>
      case 'grants':
        return <span>REStake manages all your {this.props.network && <strong onClick={this.showNetworkSelect} className="text-decoration-underline text-nowrap" role="button">{this.props.network.prettyName}</strong>} Authz grants in one place</span>
    }
    return <span>REStake allows validators to <strong onClick={() => this.setState({ showAbout: true })} className="text-decoration-underline" role="button">auto-compound</strong> your {this.props.network && <strong onClick={this.showNetworkSelect} className="text-decoration-underline text-nowrap" role="button">{this.props.network.prettyName}</strong>} staking rewards</span>
  }

  networkAlertProps() {
    if(!this.props.network?.networkAlert) return {}

    let props = { variant: 'info', dismissible: false }
    if(typeof this.props.network.networkAlert === 'string'){
      props = { ...props, message: this.props.network.networkAlert }
    }else{
      props = { ...props, ...this.props.network.networkAlert }
    }
    return props
  }

  render() {
    const isViewingOther = this.state.address && !this.viewingWallet();
    const granterGrants = this.state.wallet?.grants?.filter(g => g.granter === this.state.address) || [];
    const grantedActions = _.uniq(granterGrants.map(g => {
      const msg = g.authorization?.msg || g.authorization?.['@type'] || '';
      return msg.split('.').slice(-1)[0].replace('Msg', '');
    })).filter(Boolean);

    return (
      <>
        <header className="rs-command-bar">
          <Container fluid="xl">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
              <div className="d-flex align-items-center gap-2 gap-md-3">
                <div className="logo d-flex align-items-center text-reset text-decoration-none">
                  <span onClick={() => this.props.setActive('networks')} role="button" className="text-reset text-decoration-none d-flex align-items-center">
                    {this.props.theme === 'light'
                      ? (
                        <img src={Logo} srcSet={`${Logo2x} 2x, ${Logo3x} 3x`} alt="REStake" style={{ height: 28, width: 'auto' }} />
                      ) : (
                        <img src={LogoWhite} srcSet={`${LogoWhite2x} 2x, ${LogoWhite3x} 3x`} alt="REStake" style={{ height: 28, width: 'auto' }} />
                      )}
                  </span>
                  {this.props.directory.testnet && (
                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle ms-2 small">testnet</span>
                  )}
                </div>

                <NetworkSelect
                  show={this.state.showNetworkSelect}
                  onHide={() => { this.setState({ showNetworkSelect: false }) }}
                  networks={this.props.networks}
                  network={this.props.network}
                  favourites={this.state.favourites || []}
                  validators={this.props.validators}
                  directory={this.props.directory}
                  changeNetworkMode={this.props.changeNetworkMode}
                  changeNetwork={this.props.changeNetwork}
                  toggleFavourite={this.toggleFavourite}
                />
              </div>

              <Nav activeKey={this.props.active} onSelect={(e) => this.props.setActive(e)} className="rs-nav-segmented order-3 order-lg-2 mx-auto mx-lg-0">
                <Nav.Item>
                  <Nav.Link id="nav-explore" eventKey="networks">
                    <Stars size={14} /><span className="d-none d-sm-inline">Explore</span>
                  </Nav.Link>
                </Nav.Item>
                {this.props.network && (
                  <>
                    <Nav.Item>
                      <Nav.Link id="nav-stake" eventKey="delegations">
                        <CoinIcon size={14} /><span className="d-none d-sm-inline">Stake</span>
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link id="nav-vote" eventKey="voting">
                        <EnvelopePaper size={14} /><span className="d-none d-sm-inline">Vote</span>
                      </Nav.Link>
                    </Nav.Item>
                    {this.state.address && this.props.network.authzSupport && (
                      <Nav.Item>
                        <Nav.Link id="nav-grant" eventKey="grants">
                          <Magic size={14} /><span className="d-none d-sm-inline">Grants</span>
                        </Nav.Link>
                      </Nav.Item>
                    )}
                    {!this.props.directory.testnet && (
                      <Nav.Item>
                        <Nav.Link id="nav-swap" eventKey="swap">
                          <CurrencyExchange size={14} /><span className="d-none d-sm-inline">Swap</span>
                        </Nav.Link>
                      </Nav.Item>
                    )}
                  </>
                )}
              </Nav>

              <div className="d-flex align-items-center gap-2 order-2 order-lg-3 flex-shrink-0">
                {this.themeIcon()}
                {this.props.network && (
                  <Dropdown as={ButtonGroup}>
                    <Dropdown.Toggle id="connect-wallet-btn" variant={null} className="rs-wallet-pill">
                      {this.state.address ? (
                        <>
                          {this.viewingWallet() ? <Key size={14} className="text-primary" /> : <Eye size={14} className="text-warning" />}
                          <span className="fw-semibold text-truncate" style={{ maxWidth: 120 }}>
                            {this.addressName()}
                          </span>
                          {this.state.balance ? (
                            <span className="text-body-secondary small tabular-nums d-none d-md-inline border-start ps-2">
                              <Coin
                                {...this.state.balance}
                                asset={this.props.network.baseAsset}
                                showValue={false}
                                showImage={false}
                              />
                            </span>
                          ) : (
                            <Spinner animation="border" role="status" className="spinner-border-sm text-secondary" />
                          )}
                        </>
                      ) : (
                        <>
                          <CashCoin size={15} className="text-primary" />
                          <span>Connect Wallet</span>
                        </>
                      )}
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end" style={{ minWidth: 260 }}>
                      {this.state.address && (
                        <>
                          <div className="px-3 py-2 border-bottom">
                            <div className="d-flex align-items-center justify-content-between gap-2">
                              <span className="small fw-semibold text-truncate">{this.addressName()}</span>
                              <div className="d-flex align-items-center gap-2">
                                <Favourite
                                  value={this.favouriteAddresses().some(el => el['address'] === this.state.address)}
                                  toggle={() => this.toggleFavouriteAddress(this.state.address, this.viewingWallet() && this.state.wallet?.name)}
                                  onTooltip="Remove saved address"
                                  offTooltip="Save address"
                                />
                                <CopyToClipboard text={this.state.address} onCopy={() => this.setCopied()}>
                                  <span role="button" className="text-body-secondary d-flex align-items-center" title="Copy address">
                                    {this.state.copied ? <ClipboardCheck className="text-success" size={14} /> : <Clipboard size={14} />}
                                  </span>
                                </CopyToClipboard>
                              </div>
                            </div>
                            <div className="font-mono small text-body-secondary">{truncateAddress(this.state.address)}</div>
                            {this.state.balance && (
                              <div className="small fw-medium mt-1 tabular-nums">
                                <Coin
                                  {...this.state.balance}
                                  asset={this.props.network.baseAsset}
                                  showImage={false}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      {this.state.wallet ? (
                        <>
                          <Dropdown.Item as="button" onClick={() => this.showWalletModal({ activeTab: 'wallet' })}>
                            Wallet & Balances
                          </Dropdown.Item>
                          <Dropdown.Item
                            as="button"
                            disabled={!this.state.wallet?.hasPermission(this.state.address, 'Send')}
                            onClick={() => this.setState({ showSendModal: true })}
                          >
                            Send {this.props.network.symbol}
                          </Dropdown.Item>
                        </>
                      ) : (
                        <>
                          <Dropdown.Header>Connect Provider</Dropdown.Header>
                          {this.signerProviders.map(provider => {
                            if(!provider.visible) return null
                            const disabledWallets = this.props.network?.disabledWallets || []
                            return <Dropdown.Item as="button" key={provider.name} onClick={() => this.connect(provider.name, true)} disabled={!provider.available() || disabledWallets.includes(provider.name)}>Connect {provider.label}</Dropdown.Item>
                          })}
                          <Dropdown.Divider />
                        </>
                      )}
                      {this.otherFavouriteAddresses().length > 0 && (
                        <>
                          <Dropdown.Divider />
                          <Dropdown.Header>Switch to Saved Address</Dropdown.Header>
                          {this.state.wallet && this.state.address !== this.state.wallet.address && (
                            <Dropdown.Item as="button" onClick={() => this.setState({ address: this.state.wallet.address })}>
                              <Key size={13} className="me-2 text-primary" />
                              {this.state.wallet.name || truncateAddress(this.state.wallet.address)} (My Wallet)
                            </Dropdown.Item>
                          )}
                          {this.otherFavouriteAddresses().map(({ address, label }) => (
                            <Dropdown.Item
                              as="button"
                              key={address}
                              active={this.state.address === address}
                              onClick={() => this.setState({ address })}
                            >
                              <Eye size={13} className="me-2 text-body-secondary" />
                              {label || truncateAddress(address)}
                            </Dropdown.Item>
                          ))}
                        </>
                      )}
                      <Dropdown.Divider />
                      <Dropdown.Item as="button" onClick={() => this.showWalletModal({ activeTab: 'saved' })}>
                        Manage Saved Addresses...
                      </Dropdown.Item>
                      {this.state.address && (
                        <>
                          <Dropdown.Divider />
                          <Dropdown.Item as="button" className="text-danger" onClick={this.disconnect}>
                            {this.state.wallet ? `Disconnect ${this.state.wallet.signerProvider?.label}` : 'Close Watch Mode'}
                          </Dropdown.Item>
                        </>
                      )}
                    </Dropdown.Menu>
                  </Dropdown>
                )}
              </div>
            </div>
          </Container>
        </header>
        <Container fluid="xl">
          <main className="my-4" id="main-content">
            {isViewingOther && (
              <div className="rs-proxy-banner" role="status">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <Eye size={16} className="text-primary flex-shrink-0" />
                  <span>
                    <strong>{this.state.wallet ? 'Watch / Authz Proxy Mode:' : 'Watch-Only Mode:'}</strong>{' '}
                    Viewing <span className="fw-semibold">{this.addressName()}</span>{' '}
                    <span className="font-mono text-body-secondary">({truncateAddress(this.state.address)})</span>
                  </span>
                  {this.state.wallet && (
                    <span className="badge bg-body text-body border">
                      {grantedActions.length > 0
                        ? `Authz: ${grantedActions.join(', ')}`
                        : 'Read-only (No Authz grants)'}
                    </span>
                  )}
                </div>
                {this.state.wallet && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => this.setState({ address: this.state.wallet.address })}
                  >
                    Return to My Wallet
                  </button>
                )}
              </div>
            )}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-2 pb-3 mb-4 border-bottom">
              <div>
                <h1 className="h4 fw-semibold mb-1">{this.pageTitle()}</h1>
                <p className="text-body-secondary small mb-0">{this.introText()}</p>
              </div>
            </div>
          {this.props.network?.experimental && this.props.active !== 'networks' && (
            <AlertMessage variant="info" dismissible={false}>
              This network was added to REStake automatically and has not been thoroughly tested yet. <a href="https://github.com/eco-stake/restake-ui/issues" target="_blank" rel="noopener noreferrer">Raise an issue</a> if you have any problems.
            </AlertMessage>
          )}
          {this.props.network?.networkAlert && (
            <AlertMessage {...this.networkAlertProps()} />
          )}
          <AlertMessage message={this.state.error} variant="danger" dismissible={false} />
          {this.props.active === 'networks' && (
            <Networks
              networks={Object.values(this.props.networks)}
              changeNetwork={this.props.changeNetwork}
              favourites={this.state.favourites}
              toggleFavourite={this.toggleFavourite} />
          )}
          {this.props.active === 'delegations' &&
            <>
              <Delegations
                theme={this.props.theme}
                network={this.props.network}
                networks={this.props.networks}
                address={this.state.address}
                wallet={this.state.wallet}
                balance={this.state.balance}
                operators={this.props.operators}
                validators={this.props.validators}
                validator={this.props.validator}
                grants={this.state.grants}
                getBalance={this.getBalance}
                showAbout={() => this.setState({ showAbout: true })}
                onGrant={this.onGrant}
                onRevoke={this.onRevoke}
              />
            </>
          }
          {this.props.active === 'voting' && (
            <Voting
              network={this.props.network}
              address={this.state.address}
              wallet={this.state.wallet}
              favouriteAddresses={this.favouriteAddresses()}
            />
          )}
          {this.props.active === 'grants' && this.state.address && this.props.network.authzSupport && (
            <Grants
              network={this.props.network}
              address={this.state.address}
              wallet={this.state.wallet}
              grants={this.state.grants}
              operators={this.props.operators}
              validators={this.props.validators}
              favouriteAddresses={this.favouriteAddresses()}
              showFavouriteAddresses={() => this.showWalletModal({ activeTab: 'saved' })}
              toggleFavouriteAddress={this.toggleFavouriteAddress}
              onGrant={this.onGrant}
              onRevoke={this.onRevoke}
              grantQuerySupport={this.state.grantQuerySupport}
            />
          )}
          {this.props.active === 'swap' && !this.props.directory.testnet && (
            <Swap
              networks={this.props.networks}
              network={this.props.network}
              wallet={this.state.wallet}
              theme={this.props.theme}
              getBalance={this.getBalance}
            />
          )}
        </main>
        <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 my-4 border-top">
          <a href="https://akash.network" target="_blank" rel="noopener noreferrer" className="col-md-4 mb-0 text-muted">
            {this.props.theme === 'light'
              ? (
                <img src={PoweredByAkash} alt="Powered by Akash" width={200} />
              ) : (
                <img src={PoweredByAkashWhite} alt="Powered by Akash" width={200} />
              )}
          </a>

          <div className="col-md-4 align-items-center text-center me-lg-auto">
            <a href="https://ecostake.com" target="_blank" rel="noopener noreferrer" className="text-reset text-decoration-none d-block mb-2">
              <span className="d-none d-sm-inline">Built with 💚&nbsp;</span> by ECO Stake 🌱
            </a>
            <a href={`https://${this.props.directory.domain}`} target="_blank" rel="noopener noreferrer" className="text-reset text-decoration-none d-block small">
              <span className="d-none d-sm-inline">Interchain APIs from</span> <u>cosmos.directory</u>
            </a>
          </div>

          <p className="col-md-4 mb-0 text-muted text-end justify-content-end d-none d-lg-flex">
            {this.props.theme === 'light'
              ? (
                <GitHubButton href="https://github.com/eco-stake/restake" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star eco-stake/restake on GitHub">Star</GitHubButton>
              ) : (
                <GitHubButton href="https://github.com/eco-stake/restake" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star eco-stake/restake on GitHub" data-color-scheme="no-preference: dark; light: dark; dark: dark;">Star</GitHubButton>
              )}
          </p>
        </footer>
        <About show={this.state.showAbout} onHide={() => this.setState({ showAbout: false })} />
        <WalletModal
          show={this.state.walletModal?.show} onHide={() => this.hideWalletModal()}
          activeTab={this.state.walletModal?.activeTab}
          network={this.props.network}
          networks={Object.values(this.props.networks)}
          address={this.state.address}
          wallet={this.state.wallet}
          balances={this.state.balances}
          favouriteAddresses={this.state.favouriteAddresses}
          updateFavouriteAddresses={this.updateFavouriteAddresses}
          toggleFavouriteAddress={this.toggleFavouriteAddress}
          setAddress={(value) => {
            this.setState({address: value})
            this.hideWalletModal()
          }}
        />
        {this.props.network && (
          <SendModal
            show={this.state.showSendModal}
            network={this.props.network}
            address={this.state.address}
            wallet={this.state.wallet}
            balances={this.state.balances}
            favouriteAddresses={this.favouriteAddresses()}
            onHide={() => this.setState({ showSendModal: false })}
            onSend={this.onSend}
          />
        )}
      </Container>
      </>
    )
  }
}

export default App;
