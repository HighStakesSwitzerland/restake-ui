import React, { useState, useEffect, useMemo, useRef } from 'react';
import FuzzySearch from 'fuzzy-search';
import { round } from 'mathjs';

import {
  Modal,
  Badge,
  Spinner
} from 'react-bootstrap';
import {
  BookmarkStar,
  BookmarkStarFill,
  ChevronDown,
  Search,
  XCircle,
  Globe,
  WrenchAdjustableCircleFill
} from 'react-bootstrap-icons';

import NetworkImage from './NetworkImage.js';
import AlertMessage from './AlertMessage.js';

function NetworkSelect(props) {
  const [show, setShow] = useState(Boolean(props.show));
  const [query, setQuery] = useState('');
  const [loadingPath, setLoadingPath] = useState(null);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (props.show && !show) {
      handleOpen();
    } else if (!props.show && show) {
      handleClose();
    }
  }, [props.show]);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (show) {
          handleClose();
        } else {
          handleOpen();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show]);

  function handleOpen() {
    setError(null);
    setQuery('');
    setActiveIndex(0);
    setShow(true);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  function handleClose() {
    setShow(false);
    setLoadingPath(null);
    setError(null);
    props.onHide && props.onHide();
  }

  const allNetworks = useMemo(() => {
    return Object.values(props.networks || {}).sort((a, b) =>
      a.prettyName.localeCompare(b.prettyName)
    );
  }, [props.networks]);

  const filteredNetworks = useMemo(() => {
    let list = allNetworks;
    if (query.trim()) {
      const searcher = new FuzzySearch(list, ['prettyName', 'symbol', 'name', 'keywords'], {
        sort: true,
      });
      list = searcher.search(query.trim());
    }
    const favSet = new Set(props.favourites || []);
    return [...list].sort((a, b) => {
      const aFav = favSet.has(a.path) ? 0 : 1;
      const bFav = favSet.has(b.path) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      if (a.online !== b.online) return a.online ? -1 : 1;
      return 0;
    });
  }, [allNetworks, query, props.favourites]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  async function selectAndSwitch(network) {
    if (!network || !network.online || loadingPath) return;

    setLoadingPath(network.path);
    setError(null);
    try {
      await network.load();
      if (network.usingDirectory && !network.connectedDirectory()) {
        throw new Error('Directory connection unavailable');
      }
      await network.connect();
      if (!network.connected) {
        throw new Error('Could not connect to any available API servers');
      }
      props.changeNetwork(network);
      handleClose();
    } catch (err) {
      console.log(err);
      setError(`Could not connect to ${network.prettyName}. Try again later.`);
      setLoadingPath(null);
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(filteredNetworks.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredNetworks[activeIndex];
      if (target) selectAndSwitch(target);
    }
  }

  const price = props.network?.baseAsset?.prices?.coingecko;
  const isTestnet = props.directory?.testnet;

  return (
    <>
      <button
        type="button"
        id="network-select-trigger"
        onClick={handleOpen}
        className="rs-chain-trigger"
        aria-label="Switch network (Cmd+K)"
      >
        {props.network ? (
          <>
            <NetworkImage
              network={props.network}
              width={22}
              height={22}
              alt={props.network.prettyName}
              className="rounded-circle flex-shrink-0"
            />
            <span className="fw-semibold text-truncate" style={{ maxWidth: 130 }}>
              {props.network.prettyName}
            </span>
            {!!price?.usd && (
              <span className="text-body-secondary small tabular-nums d-none d-lg-inline">
                ${price.usd.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
              </span>
            )}
            <span
              className={`rs-status-dot d-none d-sm-inline-block ${props.network.authzSupport ? 'bg-success' : 'bg-secondary'}`}
              title={props.network.authzSupport ? 'Authz supported' : 'No Authz'}
            />
          </>
        ) : (
          <span className="fw-medium">Select Network</span>
        )}
        <span className="rs-kbd d-none d-md-inline-flex ms-1">⌘K</span>
        <ChevronDown className="text-body-secondary flex-shrink-0" size={12} />
      </button>

      <Modal show={show} onHide={handleClose} centered size="md" contentClassName="border-0 shadow-lg">
        <Modal.Header closeButton className="pb-2 border-bottom-0">
          <div className="d-flex align-items-center justify-content-between w-100 me-2">
            <Modal.Title className="fs-6 fw-semibold">Switch Network</Modal.Title>
            {props.changeNetworkMode && (
              <div className="btn-group btn-group-sm" role="group" aria-label="Network environment">
                <button
                  type="button"
                  className={`btn btn-sm ${!isTestnet ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => props.changeNetworkMode('mainnet')}
                >
                  <Globe size={12} className="me-1" />Mainnet
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${isTestnet ? 'btn-warning' : 'btn-outline-secondary'}`}
                  onClick={() => props.changeNetworkMode('testnet')}
                >
                  <WrenchAdjustableCircleFill size={12} className="me-1" />Testnet
                </button>
              </div>
            )}
          </div>
        </Modal.Header>
        <Modal.Body className="pt-1">
          <div className="input-group mb-3">
            <span className="input-group-text bg-transparent border-end-0 text-body-secondary">
              <Search size={14} />
            </span>
            <input
              ref={inputRef}
              type="text"
              className="form-control border-start-0 border-end-0"
              placeholder="Search by chain name or ticker..."
              aria-label="Search networks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            {query && (
              <button
                type="button"
                className="btn border border-start-0 text-body-secondary"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <XCircle size={14} />
              </button>
            )}
          </div>

          {error && <AlertMessage variant="danger" message={error} />}

          <div className="rs-cmd-list d-flex flex-column gap-1">
            {filteredNetworks.length === 0 ? (
              <div className="text-center py-4 text-body-secondary small">
                No networks match "{query}".
              </div>
            ) : (
              filteredNetworks.map((net, idx) => {
                const isFav = (props.favourites || []).includes(net.path);
                const isCurrent = props.network?.path === net.path;
                const isLoading = loadingPath === net.path;
                const netPrice = net.baseAsset?.prices?.coingecko?.usd;
                return (
                  <div
                    key={net.path}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectAndSwitch(net)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectAndSwitch(net);
                      }
                    }}
                    className={`rs-cmd-item ${idx === activeIndex ? 'is-active' : ''} ${isCurrent ? 'is-current' : ''} ${!net.online ? 'opacity-50' : ''}`}
                  >
                    <NetworkImage
                      network={net}
                      width={32}
                      height={32}
                      alt={net.prettyName}
                      className="rounded-circle flex-shrink-0"
                    />
                    <div className="flex-grow-1 min-w-0">
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-semibold text-truncate">{net.prettyName}</span>
                        {net.symbol && (
                          <span className="text-body-secondary small font-mono">{net.symbol}</span>
                        )}
                        {!net.online && (
                          <Badge bg="secondary-subtle" className="text-body-secondary border small">Offline</Badge>
                        )}
                      </div>
                      <div className="d-flex align-items-center gap-2 small text-body-secondary tabular-nums">
                        {net.estimatedApr ? (
                          <span>{round(net.estimatedApr * 100, 1)}% APR</span>
                        ) : null}
                        {net.restakeSupport && net.operatorCount > 0 ? (
                          <span>• {net.operatorCount} REStake</span>
                        ) : (
                          <span>• Manual</span>
                        )}
                        {netPrice ? <span>• ${netPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> : null}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      {isLoading ? (
                        <Spinner animation="border" size="sm" className="text-primary" />
                      ) : (
                        <Badge
                          bg={null}
                          className={`rounded-pill ${
                            net.authzSupport
                              ? 'bg-success-subtle text-success-emphasis border border-success-subtle'
                              : 'bg-secondary-subtle text-secondary-emphasis border'
                          }`}
                        >
                          {net.authzSupport ? 'Authz' : 'No Authz'}
                        </Badge>
                      )}
                      {props.toggleFavourite && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-1 text-body-secondary"
                          aria-label={isFav ? `Remove ${net.prettyName} from favourites` : `Add ${net.prettyName} to favourites`}
                          onClick={(e) => {
                            e.stopPropagation();
                            props.toggleFavourite(net);
                          }}
                        >
                          {isFav ? <BookmarkStarFill className="text-success" size={15} /> : <BookmarkStar size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default NetworkSelect;
