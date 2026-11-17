import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'

import {
  Row,
  Col,
  Card,
  Nav,
  Button
} from 'react-bootstrap'
import { Search, XCircle, BookmarkStar, BookmarkStarFill } from "react-bootstrap-icons";
import NetworkChecks from './NetworkChecks';
import NetworkImage from './NetworkImage';
import Favourite from './Favourite';

function Networks(props) {
  const { networks, favourites } = props

  const [filter, setFilter] = useState({keywords: '', group: 'favourites'})
  const [results, setResults] = useState([])

  useEffect(() => {
    let filtered = filteredNetworks(networks, filter)
    let group = filter.group
    while(filtered.length < 1 && group !== 'all'){
      group = group == 'featured' ? 'all' : 'featured'
      filtered = filteredNetworks(networks, {...filter, group})
      if(filtered.length > 0 || group === 'all'){
        return setFilter({ ...filter, group })
      }
    }
    setResults(filtered)
  }, [networks, filter]);

  function filterNetworks(event){
    setFilter({...filter, keywords: event.target.value})
  }

  function filteredNetworks(networks, filter){
    let searchResults = networks
    const { keywords, group } = filter

    switch (group) {
      case 'favourites':
        searchResults = searchResults.filter((network) => favourites.includes(network.path))
        break;
      case 'featured':
        searchResults = searchResults.filter((network) => network.ownerAddress)
        break;
    }

    if (!keywords || keywords === '') return searchResults

    const searcher = new FuzzySearch(
      searchResults, ['prettyName', 'keywords'],
      { sort: true }
    )

    return searcher.search(keywords)
  }

  async function changeNetwork(network){
    if(!network.online) return

    await network.load()
    await network.connect()
    props.changeNetwork(network)
  }

  function renderNetworks(networks){
    if (networks.length === 0) {
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
                onClick={() => setFilter({ keywords: '', group: 'all' })}
              >
                Show all networks
              </Button>
            )}
          </div>
        </div>
      )
    }

    return (
      <Row xs={1} sm={2} lg={3} xxl={4} className="g-4 justify-content-center">
        {networks.map((network) => (
          <Col key={network.path} className={network.online ? '' : 'opacity-50'}>
            <Card className="rs-surface-card h-100 p-2 position-relative">
              <Favourite
                value={favourites.includes(network.path)}
                toggle={() => props.toggleFavourite(network)}
                onTooltip="Remove favourite network"
                offTooltip="Favourite network"
                onIcon={BookmarkStarFill}
                offIcon={BookmarkStar}
                className="text-success text-right position-absolute top-0 end-0 p-2"
                style={{ zIndex: 2 }}
              />
              <span
                role={network.online ? 'button' : undefined}
                tabIndex={network.online ? 0 : undefined}
                aria-label={network.online ? `Select ${network.prettyName}` : `${network.prettyName} (Offline)`}
                className="stretched-link text-decoration-none text-reset"
                onClick={() => changeNetwork(network)}
                onKeyDown={(e) => {
                  if (network.online && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    changeNetwork(network)
                  }
                }}
              >
                <Row className="g-0 align-items-center h-100">
                  <Col xs={3} className="text-center">
                    <NetworkImage network={network} width={56} height={56} className="m-1 shadow-sm overflow-hidden rounded-circle" />
                  </Col>
                  <Col xs={9}>
                    <Card.Body className="py-2 px-2">
                      <Card.Title className="text-truncate pe-4 mb-1 fs-6 fw-semibold">{network.prettyName}</Card.Title>
                      <NetworkChecks network={network} className="small" skipConnected={true} style={{position: 'relative', zIndex: 2}} />
                    </Card.Body>
                  </Col>
                </Row>
              </span>
            </Card>
          </Col>
        ))}
      </Row>
    )
  }

  return (
    <>
      <div className="rs-toolbar d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div className="input-group flex-grow-1" style={{ maxWidth: 360, minWidth: 220 }}>
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
            onClick={() => setFilter({...filter, keywords: ''})}
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
          onSelect={(e) => setFilter({...filter, group: e})}
        >
          <Nav.Item>
            <Nav.Link eventKey="favourites" disabled={filteredNetworks(networks, {...filter, group: 'favourites'}).length < 1}>Favourites</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="featured" disabled={filteredNetworks(networks, {...filter, group: 'featured'}).length < 1}>Featured</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="all">All Networks</Nav.Link>
          </Nav.Item>
        </Nav>
      </div>
      {renderNetworks(results)}
    </>
  );
}

export default Networks;
