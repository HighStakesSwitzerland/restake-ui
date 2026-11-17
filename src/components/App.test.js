import axios from 'axios';
import { toBech32 } from '@cosmjs/encoding';
import { sanitizeUrl, isValidBech32Address } from '../utils/Helpers.mjs';
import Proposal from '../utils/Proposal.mjs';

jest.mock('axios');

describe('sanitizeUrl', () => {
  test('accepts valid http and https URLs', () => {
    expect(sanitizeUrl('https://example.com/path?a=1')).toBe('https://example.com/path?a=1');
    expect(sanitizeUrl('http://example.org')).toBe('http://example.org/');
  });

  test('prepends https:// when defaultHttps is true and no scheme is present', () => {
    expect(sanitizeUrl('validator.example.com', { defaultHttps: true })).toBe('https://validator.example.com/');
    expect(sanitizeUrl('validator.example.com')).toBeNull();
  });

  test('rejects javascript:, data:, and invalid URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('javascript:alert(1)', { defaultHttps: true })).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeUrl('not a valid url')).toBeNull();
    expect(sanitizeUrl('')).toBeNull();
    expect(sanitizeUrl(null)).toBeNull();
  });
});

describe('isValidBech32Address', () => {
  const cosmosAddr = toBech32('cosmos', new Uint8Array(20).fill(1));

  test('accepts valid bech32 address with matching prefix', () => {
    expect(isValidBech32Address(cosmosAddr, 'cosmos')).toBe(true);
    expect(isValidBech32Address(` ${cosmosAddr} `, 'cosmos')).toBe(true);
    expect(isValidBech32Address(cosmosAddr)).toBe(true);
  });

  test('rejects mismatched prefix', () => {
    expect(isValidBech32Address(cosmosAddr, 'osmo')).toBe(false);
  });

  test('rejects invalid checksum or random strings', () => {
    const tampered = cosmosAddr.slice(0, -1) + (cosmosAddr.endsWith('a') ? 'b' : 'a');
    expect(isValidBech32Address(tampered, 'cosmos')).toBe(false);
    expect(isValidBech32Address('cosmos1notvalid', 'cosmos')).toBe(false);
    expect(isValidBech32Address('random-string', 'cosmos')).toBe(false);
    expect(isValidBech32Address('')).toBe(false);
  });
});

describe('Proposal metadata parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles JSON metadata object without summary without crashing', async () => {
    const proposal = await Proposal({
      id: '1',
      status: 'PROPOSAL_STATUS_VOTING_PERIOD',
      metadata: JSON.stringify({ title: 'Test Proposal' })
    });

    expect(proposal.proposal_id).toBe('1');
    expect(proposal.title).toBe('Test Proposal');
    expect(proposal.description).toBeUndefined();
    expect(proposal.isSpam).toBe(false);
  });

  test('rejects private and loopback https:// metadata URLs', async () => {
    for (const url of [
      'https://localhost/meta.json',
      'https://127.0.0.1/meta.json',
      'https://10.0.0.1/meta.json',
      'https://192.168.1.1/meta.json',
      'https://169.254.169.254/latest/meta-data/',
      'https://172.16.0.1/meta.json',
      'https://[::1]/meta.json'
    ]) {
      const proposal = await Proposal({
        id: '2',
        status: 'PROPOSAL_STATUS_VOTING_PERIOD',
        metadata: url
      });
      expect(axios.get).not.toHaveBeenCalled();
      expect(proposal.description).toBe(url);
      expect(proposal.isSpam).toBe(false);
    }
  });
});

