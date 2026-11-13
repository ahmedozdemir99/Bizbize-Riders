export const rideChecks = [
  { id: 'bike', label: 'Motosiklet kontrolü' },
  { id: 'gear', label: 'Kask ve ekipman' },
  { id: 'fuel', label: 'Yakıt ve mola planı' },
  { id: 'route', label: 'Buluşma saati ve rota teyidi' },
] as const;

export interface RidePlan {
  id: string;
  title: string;
  startsAt: string;
  meetingPoint: string;
  destination: string;
  stops: string;
  notes: string;
  checked: string[];
  updatedAt: number;
}

const storageKey = 'rider_ride_plans_v1';
const rideDate = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

export function formatRideDate(startsAt: string) {
  return rideDate.format(new Date(startsAt));
}

export function parseRidePlans(value: unknown): RidePlan[] {
  if (!Array.isArray(value)) throw new Error('Sürüş planları geçersiz.');
  const ids = new Set<string>();
  for (const plan of value) {
    if (!plan || typeof plan.id !== 'string' || !plan.id || ids.has(plan.id) ||
      typeof plan.startsAt !== 'string' || !Number.isFinite(Date.parse(plan.startsAt)) ||
      !Number.isFinite(new Date(plan.updatedAt).getTime()) || typeof plan.updatedAt !== 'number' ||
      ![plan.title, plan.meetingPoint, plan.destination].every(field => typeof field === 'string' && field.trim()) ||
      typeof plan.stops !== 'string' || typeof plan.notes !== 'string' ||
      !Array.isArray(plan.checked) || !plan.checked.every((id: unknown) => typeof id === 'string')) {
      throw new Error('Sürüş planlarından biri geçersiz.');
    }
    ids.add(plan.id);
  }
  return value;
}

export function readRidePlans(): RidePlan[] {
  return parseRidePlans(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
}

export function writeRidePlans(plans: RidePlan[]) {
  localStorage.setItem(storageKey, JSON.stringify(plans));
}

export function mergeRidePlans(current: RidePlan[], incoming: RidePlan[]) {
  const plans = new Map(current.map(plan => [plan.id, plan]));
  for (const plan of incoming) {
    const existing = plans.get(plan.id);
    if (!existing || existing.updatedAt < plan.updatedAt) plans.set(plan.id, plan);
  }
  return [...plans.values()];
}

export function rideRouteUrl(plan: RidePlan) {
  const params = new URLSearchParams({
    api: '1',
    origin: plan.meetingPoint,
    destination: plan.destination,
    travelmode: 'driving',
  });
  const stops = plan.stops.split('\n').map(stop => stop.trim()).filter(Boolean).slice(0, 3);
  if (stops.length) params.set('waypoints', stops.join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

export function formatRideMessage(plan: RidePlan) {
  return [
    `🏍️ Sürüş planı · ${plan.title}`,
    formatRideDate(plan.startsAt),
    `Buluşma · ${plan.meetingPoint}`,
    `Varış · ${plan.destination}`,
    plan.stops && `Duraklar · ${plan.stops.split('\n').join(' → ')}`,
    plan.notes,
    rideRouteUrl(plan),
  ].filter(Boolean).join('\n');
}

export function downloadRideCalendar(plan: RidePlan) {
  const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;').replace(/,/g, '\\,');
  const timestamp = (value: string) => new Date(value).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BizBize Riders//Ride Plans//TR', 'BEGIN:VEVENT',
    `UID:${escape(plan.id)}@bizbize-riders`,
    `DTSTAMP:${timestamp(new Date(plan.updatedAt).toISOString())}`,
    `DTSTART:${timestamp(plan.startsAt)}`,
    `SUMMARY:${escape(plan.title)}`,
    `LOCATION:${escape(plan.meetingPoint)}`,
    `DESCRIPTION:${escape(formatRideMessage(plan))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const encoder = new TextEncoder();
  const folded = lines.map(line => {
    let result = '';
    let bytes = 0;
    for (const char of line) {
      const width = encoder.encode(char).length;
      if (bytes + width > 75) {
        result += '\r\n ';
        bytes = 1;
      }
      result += char;
      bytes += width;
    }
    return result;
  });
  const url = URL.createObjectURL(new Blob([folded.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'bizbize-surus.ics';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
