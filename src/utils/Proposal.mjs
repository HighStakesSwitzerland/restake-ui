import axios from 'axios'
import { cid as isIPFSCID } from 'is-ipfs'

export const PROPOSAL_STATUSES = {
  '': 'All',
  'PROPOSAL_STATUS_DEPOSIT_PERIOD': 'Deposit Period',
  'PROPOSAL_STATUS_VOTING_PERIOD': 'Voting Period',
  'PROPOSAL_STATUS_PASSED': 'Passed',
  'PROPOSAL_STATUS_REJECTED': 'Rejected',
  'PROPOSAL_STATUS_FAILED': 'Failed'
}

export const PROPOSAL_SCAM_URLS = [
  'v2terra.d',
  'terrapro.a',
  'cosmos-network.io',
  'terraweb.at',
  'cosmoweb.at'
]

function getSafeMetadataUrl(metadata) {
  if (!metadata || typeof metadata !== 'string') return null
  if (metadata.startsWith('ipfs://') && metadata !== 'ipfs://CID') {
    return metadata.replace('ipfs://', 'https://ipfs.io/ipfs/')
  }
  if (metadata.startsWith('https://')) {
    try {
      const parsed = new URL(metadata)
      if (parsed.protocol !== 'https:') return null
      const hostname = parsed.hostname.toLowerCase()
      if (
        !hostname ||
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]' ||
        hostname === '::1' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('169.254.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
      ) {
        return null
      }
      return parsed.href
    } catch {
      return null
    }
  }
  if (isIPFSCID(metadata)) {
    return `https://ipfs.io/ipfs/${metadata}`
  }
  return null
}

const Proposal = async (data) => {
  let { proposal_id, content, messages, metadata, title, summary: description } = data
  if(!proposal_id && data.id) proposal_id = data.id
  if(typeof title !== 'string') title = undefined
  if(typeof description !== 'string') description = undefined

  let typeHuman
  if(metadata){
    try {
      const parsedMetadata = JSON.parse(metadata)
      if (parsedMetadata && typeof parsedMetadata === 'object') {
        metadata = parsedMetadata
        if (!title && typeof metadata.title === 'string') title = metadata.title
        if (!description && typeof metadata.summary === 'string') description = metadata.summary
      }
    } catch {
      try {
        const ipfsUrl = getSafeMetadataUrl(metadata)
        if(ipfsUrl) {
          let response = await axios.get(ipfsUrl, {
            timeout: 5000,
            maxContentLength: 1024 * 1024,
            maxBodyLength: 1024 * 1024
          })
          if(response.headers['content-type']?.includes('application/json') && response.data && typeof response.data === 'object'){
            metadata = response.data
            if (typeof metadata.title === 'string') title = metadata.title
            const remoteDescription = metadata.summary || metadata.description || metadata.details
            if (typeof remoteDescription === 'string') description = remoteDescription
          }
        }
      } catch (e) {
        console.log(e)
      }
    }
  }

  if(messages){
    content = messages.find(el => el['@type'] === '/cosmos.gov.v1.MsgExecLegacyContent')?.content
    messages = messages.filter(el => el['@type'] !== '/cosmos.gov.v1.MsgExecLegacyContent')
    typeHuman = messages.map(el => el['@type'].split('.').reverse()[0]).slice(0, 3).join(', ')
  }

  if(content){
    if (!title && typeof content.title === 'string') title = content.title
    if (!description && typeof content.description === 'string') description = content.description
    typeHuman = typeHuman || (content['@type'] ? content['@type'].split('.').reverse()[0] : 'Unknown')
  }

  title = title || typeHuman
  if (!description && typeof metadata === 'string') description = metadata

  const statusHuman = PROPOSAL_STATUSES[data.status]

  const isDeposit = data.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD'
  const isVoting = data.status === 'PROPOSAL_STATUS_VOTING_PERIOD'
  const isSpam = typeof description === 'string' && PROPOSAL_SCAM_URLS.some(url => description.toLowerCase().includes(url))

  return {
    ...data,
    proposal_id,
    title,
    typeHuman,
    statusHuman,
    description,
    content,
    metadata,
    isDeposit,
    isVoting,
    isSpam
  }
}

export default Proposal;
