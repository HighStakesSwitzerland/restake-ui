import React, { useState, useReducer, useEffect } from 'react';

import {
  Button,
  Modal,
  Form,
  Badge
} from 'react-bootstrap'

import Select from 'react-select';
import NetworkChecks from './NetworkChecks.js';
import NetworkImage from './NetworkImage.js';
import Favourite from './Favourite.js';
import { BookmarkStar, BookmarkStarFill, ChevronDown } from 'react-bootstrap-icons';

function NetworkSelect(props) {
  const [show, setShow] = useState(props.show);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState();
  const [options, setOptions] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    { networks: [], operators: [], network: { value: '' } }
  )

  function handleOpen() {
    setSelectedNetwork(props.network);
    setShow(true);
  }

  function handleClose() {
    setSelectedNetwork();
    setShow(false);
    props.onHide();
  }

  function handleSubmit(event) {
    event.preventDefault();

    props.changeNetwork(selectedNetwork);
    handleClose();
  }

  function selectNetwork(newValue) {
    const network = props.networks[newValue.value.replace(/^(favourite-)/,'')];
    if (network) {
      setLoading(true);
      setError(false);
      network.load().then(() => {
        setSelectedNetwork(network);
        if (network.usingDirectory && !network.connectedDirectory()) {
          throw false;
        }
        return network.connect().then(() => {
          if (network.connected) {
            setLoading(false);
          } else {
            throw false;
          }
        });
      }).catch(error => {
        console.log(error);
        setError('Could not connect to this network. Try again later');
        setLoading(false);
      });
    }
  }

  function selectedOption(){
    let networks = options.networks
    if(options.grouped){
      networks = options.grouped.map(el => el.options).flat()
    }
    return networks.find(el => el.value === options.network)
  }

  useEffect(() => {
    if (props.show && !show) {
      handleOpen()
    } else if (!props.show && show) {
      handleClose()
    }
  }, [props.show])

  useEffect(() => {
    const networks = Object.values(props.networks).sort((a, b) => a.name > b.name ? 1 : -1)
    const networkOptions = networks.map(network => {
      return {
        value: network.path,
        label: network.prettyName,
        image: network.image,
        operatorCount: network.operatorCount,
        authz: network.authzSupport,
        online: network.online,
        experimental: network.experimental
      }
    })
    const isFavourite = selectedNetwork && props.favourites && props.favourites.includes(selectedNetwork.path)
    setOptions({
      networks: networkOptions,
      network: isFavourite ? `favourite-${selectedNetwork.path}` : selectedNetwork && selectedNetwork.path,
      grouped: props.favourites && props.favourites.length > 0 && [
        {
          label: 'Favourites',
          options: networkOptions.filter(el => props.favourites.includes(el.value)).map(el => {
            return {...el, value: `favourite-${el.value}`}
          })
        },
        {
          label: 'All Networks',
          options: networkOptions
        }
      ]
    })
  }, [props.networks, selectedNetwork, props.favourites])

  const price = props.network?.baseAsset?.prices?.coingecko

  return (
    <>
      <Button id="network-select-trigger" onClick={handleOpen} variant="outline-secondary" className="d-flex flex-nowrap text-nowrap align-items-center gap-2 text-reset">
        {props.network ? (
          <>
            <NetworkImage network={props.network} width={28} height={28} alt={props.network.prettyName} className="text-white" />
            <div className="d-none d-md-flex align-items-baseline gap-2">
              <span className="h6 mb-0">{props.network.prettyName}</span>
              {!!price?.usd && (
                <em className="text-muted small">${price.usd.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</em>
              )}
            </div>
            <div className="d-none d-md-block">
              {props.network.authzSupport
                ? <Badge bg={null} className="rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle">Authz</Badge>
                : <Badge bg={null} className="rounded-pill bg-secondary-subtle text-secondary-emphasis border">No Authz</Badge>
              }
            </div>
          </>
        ) : (
          <div className="d-none d-md-block">
            <span className="h6 mb-0">Choose a Network</span>
          </div>
        )}
        <ChevronDown className="text-muted ms-1" size={14} />
      </Button>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Change Network</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            {props.networks &&
              <div className="row mb-3">
                <div className="col">
                  <div className="d-flex align-content-center">
                    <div className="flex-fill">
                      <Select
                        value={selectedOption()}
                        isClearable={false}
                        name="network"
                        options={options.grouped || options.networks}
                        onChange={selectNetwork}
                        formatOptionLabel={network => (
                          <div className={'d-flex align-items-center' + (!network.online ? ' text-muted' : '')}>
                            <div className="pe-2">
                              <NetworkImage network={network} width={30} height={30} alt={network.label} />
                            </div>
                            <div className="me-auto">
                              <span className="ms-1">{network.label} {!network.online && <small>(Offline)</small>}</span>
                            </div>
                            <div className="text-end d-none d-sm-block">
                              {network.restakeSupport && network.operatorCount > 0 &&
                                <small>{network.operatorCount} Operator{network.operatorCount > 1 ? 's' : ''}</small>
                              }
                            </div>
                            <div className="text-end">
                              {network.authz
                                ? <Badge bg={null} className={`ms-3 rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle` + (!network.online ? ' opacity-50' : '')}>Authz</Badge>
                                : <Badge bg={null} className={`ms-3 rounded-pill bg-secondary-subtle text-secondary-emphasis border` + (!network.online ? ' opacity-50' : '')}>No Authz</Badge>
                              }
                            </div>
                          </div>
                        )}
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor: 'var(--bs-body-bg)',
                            borderColor: state.isFocused ? 'var(--bs-primary)' : 'var(--bs-border-color)',
                            color: 'var(--bs-body-color)',
                            boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25)' : 'none',
                            '&:hover': {
                              borderColor: state.isFocused ? 'var(--bs-primary)' : 'var(--bs-border-color)',
                            },
                          }),
                          menu: (base) => ({
                            ...base,
                            backgroundColor: 'var(--bs-body-bg)',
                            border: '1px solid var(--bs-border-color)',
                            color: 'var(--bs-body-color)',
                            zIndex: 1060,
                          }),
                          menuList: (base) => ({
                            ...base,
                            backgroundColor: 'var(--bs-body-bg)',
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected || state.isFocused
                              ? 'var(--bs-tertiary-bg)'
                              : 'var(--bs-body-bg)',
                            color: 'var(--bs-body-color)',
                            cursor: 'pointer',
                            ':active': {
                              backgroundColor: 'var(--bs-tertiary-bg)',
                            },
                          }),
                          input: (base) => ({
                            ...base,
                            color: 'var(--bs-body-color)',
                          }),
                          singleValue: (base) => ({
                            ...base,
                            color: 'var(--bs-body-color)',
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: 'var(--bs-secondary-color)',
                          }),
                          groupHeading: (base) => ({
                            ...base,
                            color: 'var(--bs-secondary-color)',
                          }),
                        }}
                        theme={(theme) => ({
                          ...theme,
                          colors: {
                            ...theme.colors,
                            neutral0: 'var(--bs-body-bg)',
                            neutral5: 'var(--bs-tertiary-bg)',
                            neutral10: 'var(--bs-tertiary-bg)',
                            neutral20: 'var(--bs-border-color)',
                            neutral30: 'var(--bs-border-color)',
                            neutral40: 'var(--bs-secondary-color)',
                            neutral50: 'var(--bs-secondary-color)',
                            neutral60: 'var(--bs-body-color)',
                            neutral70: 'var(--bs-body-color)',
                            neutral80: 'var(--bs-body-color)',
                            neutral90: 'var(--bs-body-color)',
                            primary: 'var(--bs-primary)',
                            primary25: 'var(--bs-tertiary-bg)',
                            primary50: 'var(--bs-secondary-bg)',
                            primary75: 'var(--bs-primary)',
                          },
                        })}
                      />
                    </div>
                    {selectedNetwork && (
                      <Favourite
                        value={props.favourites.includes(selectedNetwork.path)}
                        toggle={() => props.toggleFavourite(selectedNetwork)}
                        onTooltip="Remove favourite network"
                        offTooltip="Favourite network"
                        onIcon={BookmarkStarFill}
                        offIcon={BookmarkStar}
                        className="text-success align-self-center ms-2"
                      />
                    )}
                  </div>
                </div>
              </div>
            }
            {selectedNetwork && (
              <>
                <NetworkChecks network={selectedNetwork} error={error} />
                <div className="text-center mt-4 mb-2">
                  {!loading
                    ? !error && <Button type="submit" className="btn btn-primary btn-lg">Change network</Button>
                    : (
                      <Button className="btn-primary btn-lg mr-5" disabled>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                        Updating...
                      </Button>
                    )}
                </div>
              </>
            )}
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default NetworkSelect
