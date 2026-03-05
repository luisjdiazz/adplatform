const META_API_VERSION = "v20.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaApiOptions {
  accessToken: string;
  adAccountId: string;
}

export async function metaApiGet(endpoint: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${META_BASE_URL}/${endpoint}`);
  url.searchParams.set("access_token", token);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API Error: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

export async function metaApiPost(endpoint: string, token: string, body: Record<string, any>) {
  const res = await fetch(`${META_BASE_URL}/${endpoint}?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API Error: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

export function getOAuthUrl(appId: string, redirectUri: string, state: string) {
  const scopes = [
    "ads_management",
    "ads_read",
    "business_management",
    "pages_read_engagement",
  ].join(",");
  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const res = await fetch(
    `${META_BASE_URL}/oauth/access_token?client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
  );
  if (!res.ok) throw new Error("Error intercambiando codigo OAuth de Meta");
  return res.json();
}

export async function getAdAccounts(token: string) {
  return metaApiGet("me/adaccounts", token, {
    fields: "id,name,account_id,account_status,currency,timezone_name",
  });
}

export async function getCampaigns(opts: MetaApiOptions) {
  return metaApiGet(`act_${opts.adAccountId}/campaigns`, opts.accessToken, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    limit: "100",
  });
}

export async function getCampaignInsights(campaignId: string, token: string) {
  return metaApiGet(`${campaignId}/insights`, token, {
    fields: "spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,frequency",
    date_preset: "last_7d",
  });
}

export async function getAdSetInsights(adSetId: string, token: string) {
  return metaApiGet(`${adSetId}/insights`, token, {
    fields: "spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,frequency",
    date_preset: "last_7d",
  });
}

export async function createCampaign(opts: MetaApiOptions, data: {
  name: string;
  objective: string;
  status?: string;
  special_ad_categories?: string[];
}) {
  return metaApiPost(`act_${opts.adAccountId}/campaigns`, opts.accessToken, {
    name: data.name,
    objective: data.objective,
    status: data.status || "PAUSED",
    special_ad_categories: data.special_ad_categories || [],
  });
}

export async function createAdSet(opts: MetaApiOptions, data: {
  name: string;
  campaignId: string;
  dailyBudget: number;
  targeting: Record<string, any>;
  billingEvent?: string;
  optimizationGoal?: string;
  bidStrategy?: string;
}) {
  return metaApiPost(`act_${opts.adAccountId}/adsets`, opts.accessToken, {
    name: data.name,
    campaign_id: data.campaignId,
    daily_budget: Math.round(data.dailyBudget * 100),
    targeting: data.targeting,
    billing_event: data.billingEvent || "IMPRESSIONS",
    optimization_goal: data.optimizationGoal || "OFFSITE_CONVERSIONS",
    bid_strategy: data.bidStrategy || "LOWEST_COST_WITHOUT_CAP",
    status: "PAUSED",
  });
}

export async function updateAdSetBudget(adSetId: string, token: string, dailyBudget: number) {
  return metaApiPost(adSetId, token, {
    daily_budget: Math.round(dailyBudget * 100),
  });
}

export async function updateAdStatus(adId: string, token: string, status: "ACTIVE" | "PAUSED") {
  return metaApiPost(adId, token, { status });
}

export async function updateAdSetStatus(adSetId: string, token: string, status: "ACTIVE" | "PAUSED") {
  return metaApiPost(adSetId, token, { status });
}
