import React, { useState, useEffect, useMemo } from 'react';
import FuzzySearch from 'fuzzy-search';
import { round } from 'mathjs';

import {
  Row,
  Col,
  Nav,
  Button,
  Spinner
} from 'react-bootstrap';
import { Search, XCircle, BookmarkStar, BookmarkStarFill } from "react-bootstrap-icons";
import NetworkImage from './NetworkImage';
import Favourite from './Favourite';
import TooltipIcon from './TooltipIcon';

function Networks(props) {
  const { networks, favourites } = props;

  const [filter, setFilter] = useState({ keywords: '', group: 'favourites', sort: 'featured' });
  const [results, setResults] = useState([]);
  const [connectingPath, setConnectingPath] = useState(null);

  const counts = useMemo(() => {
    const list = networks || [];
    return {
      favourites: list.filter((n) => favourites.includes(n.path)).length,
      featured: list.filter((n) => n.ownerAddress).length,
      restake: list.filter((n) => n.restakeSupport && n.operatorCount > 0).length,
      all: list.length,
    };
  }, [networks, favourites]);

  useEffect(() => {
    let filtered = filteredNetworks(networks, filter);
    let group = filter.group;
    while (filtered.length < 1 && group !== 'all' && !filter.keywords) {
      group = group === 'favourites' ? 'featured' : 'all';
      filtered = filteredNetworks(networks, { ...filter, group });
      if (filtered.length > 0 || group === 'all') {
        return setFilter({ ...filter, group });
      }
    }
    setResults(filtered);
  }, [networks, filter, favourites]);

  function filterNetworks(event) {
    setFilter({ ...filter, keywords: event.target.value });
  }

  function sortNetworks(list, sortBy) {
    return [...list].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      switch (sortBy) {
        case 'apr':
          return (b.estimatedApr || 0) - (a.estimatedApr || 0);
        case 'operators':
          return (b.operatorCount || 0) - (a.operatorCount || 0);
        case 'name':
          return a.prettyName.localeCompare(b.prettyName);
        case 'featured':
        default: {
          const aFeat = a.ownerAddress ? 0 : 1;
          const bFeat = b.ownerAddress ? 0 : 1;
          if (aFeat !== bFeat) return aFeat - bFeat;
          return (b.operatorCount || 0) - (a.operatorCount || 0);
        }
      }
    });
  }

  function filteredNetworks(networks, currentFilter) {
    let searchResults = networks || [];
    const { keywords, group, sort } = currentFilter;

    switch (group) {
      case 'favourites':
        searchResults = searchResults.filter((network) => favourites.includes(network.path));
        break;
      case 'featured':
        searchResults = searchResults.filter((network) => network.ownerAddress);
        break;
      case 'restake':
        searchResults = searchResults.filter((network) => network.restakeSupport && network.operatorCount > 0);
        break;
      default:
        break;
    }

    if (!keywords || keywords.trim() === '') {
      return sortNetworks(searchResults, sort);
    }

    const searcher = new FuzzySearch(
      searchResults,
      ['prettyName', 'symbol', 'name', 'keywords'],
      { sort: true }
    );

    return searcher.search(keywords.trim());
  }

  async function changeNetwork(network) {
    if (!network.online || connectingPath) return;

    setConnectingPath(network.path);
    try {
      await network.load();
      await network.connect();
      props.changeNetwork(network);
    } finally {
      setConnectingPath(null);
    }
  }

  function renderStatus(network) {
    if (!network.online) {
      return { dotClass: 'bg-danger', label: 'Offline', tooltip: 'API servers currently unreachable' };
    }
    if (network.experimental) {
      return {
        dotClass: 'bg-warning',
        label: 'Experimental',
        tooltip: 'Automatically imported from Chain Registry; not yet thoroughly tested.'
      };
    }
    if (network.authzSupport) {
      return {
        dotClass: 'bg-success',
        label: network.authzAminoGenericOnly ? 'Authz (Basic)' : 'Authz Ready',
        tooltip: network.restakeSupport
          ? `Full Authz auto-compounding supported (${network.operatorCount} operators)`
          : 'Authz supported for governance & proxy grants'
      };
    }
    return {
      dotClass: 'bg-secondary',
      label: 'Manual Only',
      tooltip: "This network doesn't support Authz yet. You can stake and claim manually."
    };
  }

  function renderNetworks(list) {
    if (list.length === 0) {
      return (
        <div className="rs-surface-card text-center py-5 px-3 my-2">
          <p className="h6 fw-semibold mb-2">No networks match your search</p>
          <p className="text-body-secondary small mb-3">
            {filter.keywords
              ? `No networks found matching "${filter.keywords}".`
              : 'No networks are available in this category.'}
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            {filter.keywords && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setFilter({ ...filter, keywords: '' })}
              >
                Clear search
              </Button>
            )}
            {filter.group !== 'all' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setFilter({ ...filter, keywords: '', group: 'all' })}
              >
                Show all networks
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <Row xs={1} sm={2} lg={3} xxl={4} className="g-3">
        {list.map((network) => {
          const price = network.baseAsset?.prices?.coingecko?.usd;
          const status = renderStatus(network);
          const isConnecting = connectingPath === network.path;

          return (
            <Col key={network.path} className={network.online ? '' : 'opacity-50'}>
              <div
                role={network.online ? 'button' : undefined}
                tabIndex={network.online ? 0 : undefined}
                aria-label={network.online ? `Select ${network.prettyName}` : `${network.prettyName} (Offline)`}
                onClick={() => changeNetwork(network)}
                onKeyDown={(e) => {
                  if (network.online && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    changeNetwork(network);
                  }
                }}
                className={`rs-network-card h-100 position-relative ${network.online ? 'rs-network-online' : ''}`}
              >
                <div className="d-flex align-items-start gap-3">
                  <NetworkImage
                    network={network}
                    width={44}
                    height={44}
                    className="rounded-circle shadow-sm flex-shrink-0"
                  />
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <h2 className="h6 fw-semibold mb-0 text-truncate">{network.prettyName}</h2>
                      <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                        <Favourite
                          value={favourites.includes(network.path)}
                          toggle={() => props.toggleFavourite(network)}
                          onTooltip="Remove favourite network"
                          offTooltip="Favourite network"
                          onIcon={BookmarkStarFill}
                          offIcon={BookmarkStar}
                          className="text-success"
                        />
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
                      <span className="font-mono small text-body-secondary">{network.symbol}</span>
                      {price ? (
                        <span className="small fw-medium tabular-nums text-body-secondary">
                          ${price.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rs-network-metrics">
                  <div>
                    <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>Est. APR</div>
                    <div className="fw-semibold small tabular-nums text-primary">
                      {network.estimatedApr ? `${round(network.estimatedApr * 100, 1)}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>Operators</div>
                    <div className="fw-semibold small tabular-nums">
                      {network.restakeSupport && network.operatorCount > 0
                        ? `${network.operatorCount}`
                        : 'Manual'}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>Status</div>
                    {isConnecting ? (
                      <Spinner animation="border" size="sm" className="text-primary" />
                    ) : (
                      <div onClick={(e) => e.stopPropagation()} className="d-inline-flex align-items-center justify-content-end gap-1">
                        <TooltipIcon
                          identifier={`net-status-${network.path}`}
                          tooltip={status.tooltip}
                          icon={
                            <span className="d-inline-flex align-items-center gap-1 small fw-medium">
                              <span className={`rs-status-dot ${status.dotClass}`} />
                              <span className="text-truncate" style={{ maxWidth: 80 }}>{status.label}</span>
                            </span>
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    );
  }

  return (
    <>
      <div className="rs-toolbar d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div className="input-group flex-grow-1" style={{ maxWidth: 320, minWidth: 220 }}>
          <span className="input-group-text bg-transparent border-end-0 text-body-secondary">
            <Search size={14} aria-hidden="true" />
          </span>
          <input
            id="network-search-input"
            className="form-control border-start-0 border-end-0"
            onChange={filterNetworks}
            value={filter.keywords}
            type="text"
            placeholder="Search networks..."
            aria-label="Search networks"
          />
          <button
            className="btn border border-start-0 text-body-secondary"
            type="button"
            onClick={() => setFilter({ ...filter, keywords: '' })}
            aria-label="Clear search"
            disabled={!filter.keywords}
          >
            <XCircle size={14} />
          </button>
        </div>

        <Nav
          variant="pills"
          activeKey={filter.group}
          className={`flex-wrap gap-1${props.modal ? ' small' : ''}`}
          onSelect={(e) => setFilter({ ...filter, group: e })}
        >
          <Nav.Item>
            <Nav.Link eventKey="favourites" disabled={counts.favourites < 1}>
              Favourites {counts.favourites > 0 && <span className="opacity-75 ms-1">({counts.favourites})</span>}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="featured" disabled={counts.featured < 1}>
              Featured
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="restake" disabled={counts.restake < 1}>
              Auto-Compound ({counts.restake})
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="all">
              All ({counts.all})
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <select
          className="form-select form-select-sm w-auto"
          aria-label="Sort networks"
          value={filter.sort}
          onChange={(e) => setFilter({ ...filter, sort: e.target.value })}
        >
          <option value="featured">Sort: Featured</option>
          <option value="apr">Sort: Highest APR</option>
          <option value="operators">Sort: Most Operators</option>
          <option value="name">Sort: A–Z</option>
        </select>
      </div>
      {renderNetworks(results)}
    </>
  );
}

export default Networks;
