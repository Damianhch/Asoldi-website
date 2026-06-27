import { getMyPhonerConfig as getConfig, listMyPhonerLeadsInList, listMyPhonerLists } from './myphoner-api.js';

export function getMyPhonerConfig() {
  return getConfig();
}

export async function testMyPhonerConnection() {
  const response = await listMyPhonerLists();
  return { connected: !!response.success, error: response.success ? '' : response.error || '' };
}

export function getDateRange(interval = 'month') {
  const now = new Date();
  const toDate = now.toISOString().slice(0, 10);
  let fromDate = new Date(now);

  if (interval === 'week') fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (interval === '3mth') fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  else if (interval === 'year') fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  else if (interval === 'thisyear') fromDate = new Date(now.getFullYear(), 0, 1);
  else fromDate = new Date(now.getFullYear(), now.getMonth(), 1);

  return { fromDate: fromDate.toISOString().slice(0, 10), toDate };
}

async function listLeadsForCampaign(campaignId, { fromDate, toDate } = {}) {
  const perPage = 100;
  const leads = [];
  for (let page = 1; page <= 200; page += 1) {
    const response = await listMyPhonerLeadsInList(campaignId, {
      per_page: perPage,
      page,
      from_date: fromDate,
      to_date: toDate,
    });
    if (!response.success) return response;
    const chunk = Array.isArray(response.data) ? response.data : [];
    leads.push(...chunk);
    if (chunk.length < perPage) break;
  }
  return { success: true, data: leads };
}

export async function getLeads(interval = 'month') {
  const config = getMyPhonerConfig();
  if (!config.campaignIds.length) {
    return { success: false, error: 'MYPHONER_CAMPAIGN_ID not configured' };
  }

  const { fromDate, toDate } = getDateRange(interval);
  const leads = [];

  for (const campaignId of config.campaignIds) {
    const response = await listLeadsForCampaign(campaignId, { fromDate, toDate });
    if (!response.success) return response;
    if (Array.isArray(response.data)) leads.push(...response.data);
  }

  return { success: true, data: leads };
}

export function calculateStatsForEmail(leads, email) {
  const normalizedEmail = String(email || '').toLowerCase();
  const matched = (leads || []).filter((lead) => {
    const claimedBy = lead.claimed_by;
    return typeof claimedBy === 'string' && claimedBy.toLowerCase() === normalizedEmail;
  });

  const totalCalls = matched.filter((lead) => {
    const state = String(lead.state || lead.status || '').toLowerCase();
    return state && state !== 'new';
  }).length;
  const meetingsBooked = matched.filter((lead) => {
    const state = String(lead.state || lead.status || '').toLowerCase();
    const outcome = String(lead.outcome || lead.category || '').toLowerCase();
    return state === 'won' || outcome === 'winner';
  }).length;
  const conversionRate = totalCalls > 0 ? Number(((meetingsBooked / totalCalls) * 100).toFixed(1)) : 0;

  return {
    totalCalls,
    meetingsBooked,
    hoursCalled: 0,
    conversionRate,
    lastSyncDate: new Date().toISOString().slice(0, 10),
  };
}

export async function syncStatsForWorkers(workers, interval = 'month') {
  const response = await getLeads(interval);
  if (!response.success) return { success: false, error: response.error || 'Failed to fetch MyPhoner leads' };

  const results = workers.map((worker) => ({
    workerId: worker.id,
    email: worker.email,
    stats: calculateStatsForEmail(response.data, worker.email),
  }));

  return { success: true, results };
}
