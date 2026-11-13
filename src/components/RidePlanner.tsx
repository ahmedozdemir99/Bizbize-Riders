import { useRef, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronRight, Clock3, MapPin, Navigation, Pencil, Plus, Route, Send, Trash2 } from 'lucide-react';
import type { CortegeGroup } from '../types';
import { downloadRideCalendar, formatRideDate, formatRideMessage, rideChecks, rideRouteUrl, type RidePlan } from '../services/ridePlans';

type RidePlannerProps = {
  plans: RidePlan[];
  groups: Record<string, { info: CortegeGroup }>;
  onSave: (plan: RidePlan) => boolean;
  onDelete: (id: string) => boolean;
  onShare: (group: CortegeGroup, message: string) => void;
};

const field = 'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-base text-zinc-100 outline-none focus:border-orange-500';
const action = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 hover:border-orange-400 hover:text-white';

export function RidePlanner({ plans, groups, onSave, onDelete, onShare }: RidePlannerProps) {
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [expanded, setExpanded] = useState<string>();
  const [editing, setEditing] = useState<RidePlan | 'new'>();
  const formRef = useRef<HTMLFormElement>(null);
  const current = typeof editing === 'object' ? editing : undefined;
  const now = Date.now();
  const upcoming = plans.filter(plan => Date.parse(plan.startsAt) >= now);
  const past = plans.filter(plan => Date.parse(plan.startsAt) < now);
  const visible = [...(filter === 'upcoming' ? upcoming : past)].sort((a, b) =>
    (Date.parse(a.startsAt) - Date.parse(b.startsAt)) * (filter === 'upcoming' ? 1 : -1));
  const groupOptions = Object.values(groups).map(group => group.info).filter(group => group?.id && !group.id.startsWith('dm_'));

  function edit(plan: RidePlan | 'new') {
    setEditing(plan);
    requestAnimationFrame(() => formRef.current?.querySelector('input')?.focus());
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    const date = new Date(value('startsAt'));
    const title = value('title');
    const meetingPoint = value('meetingPoint');
    const destination = value('destination');
    if (!title || !meetingPoint || !destination || !Number.isFinite(date.getTime())) return;
    const plan: RidePlan = {
      id: current?.id ?? crypto.randomUUID(),
      title, meetingPoint, destination,
      startsAt: date.toISOString(),
      stops: value('stops').split('\n').map(stop => stop.trim()).filter(Boolean).slice(0, 3).join('\n'),
      notes: value('notes'),
      checked: current?.checked ?? [],
      updatedAt: Date.now(),
    };
    if (!onSave(plan)) return;
    setFilter(date.getTime() >= Date.now() ? 'upcoming' : 'past');
    setExpanded(plan.id);
    setEditing(undefined);
  }

  const localDate = current ? new Date(current.startsAt) : undefined;
  const inputDate = localDate ? new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

  return (
    <main className="flex-1 overflow-y-auto bg-[#101113]">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-7 sm:py-7">
        <section className="ride-banner rounded-3xl border border-orange-500/20 p-5 sm:p-7">
          <Route aria-hidden="true" className="mb-4 size-7 text-orange-400" />
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Sürüş Planları</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-300">Buluşmayı belirle, rotayı çıkar ve kortejine haber ver. Planların bu tarayıcıda saklanır.</p>
          <button type="button" onClick={() => edit('new')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 font-bold text-zinc-950 hover:bg-orange-400">
            <Plus aria-hidden="true" className="size-5" /> Yeni sürüş
          </button>
        </section>

        {editing && (
          <form key={current?.id ?? 'new'} ref={formRef} onSubmit={save} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
            <h3 className="text-xl font-semibold">{current ? 'Sürüşü düzenle' : 'Sürüş oluştur'}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-zinc-300">Sürüş adı<input className={field} name="title" defaultValue={current?.title} required maxLength={80} pattern=".*\S.*" /></label>
              <label className="min-w-0 space-y-1 text-sm text-zinc-300">Tarih ve saat<input className={field} name="startsAt" type="datetime-local" defaultValue={inputDate} required /></label>
              <label className="space-y-1 text-sm text-zinc-300">Buluşma noktası<input className={field} name="meetingPoint" defaultValue={current?.meetingPoint} required maxLength={120} pattern=".*\S.*" /></label>
              <label className="space-y-1 text-sm text-zinc-300">Varış noktası<input className={field} name="destination" defaultValue={current?.destination} required maxLength={120} pattern=".*\S.*" /></label>
              <label className="space-y-1 text-sm text-zinc-300">Ara duraklar (en fazla üç, satır başına bir)<textarea className={field} name="stops" defaultValue={current?.stops} maxLength={300} rows={3} /></label>
              <label className="space-y-1 text-sm text-zinc-300">Notlar<textarea className={field} name="notes" defaultValue={current?.notes} maxLength={500} rows={3} /></label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-zinc-950 hover:bg-orange-400">Planı kaydet</button>
              <button className={action} type="button" onClick={() => setEditing(undefined)}>Vazgeç</button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Sürüşleri filtrele">
          <button className={action + ' aria-pressed:border-orange-400 aria-pressed:text-orange-300'} aria-pressed={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>Yaklaşan ({upcoming.length})</button>
          <button className={action + ' aria-pressed:border-orange-400 aria-pressed:text-orange-300'} aria-pressed={filter === 'past'} onClick={() => setFilter('past')}>Geçmiş ({past.length})</button>
        </div>

        {!visible.length && (
          <div className="rounded-2xl border border-dashed border-zinc-700 p-7 text-center text-zinc-400">
            <CalendarDays aria-hidden="true" className="mx-auto mb-3 size-6 text-orange-400" />
            {filter === 'upcoming' ? 'Yaklaşan sürüş planı yok.' : 'Geçmiş sürüş planı yok.'}
          </div>
        )}

        {visible.map(plan => {
          const checkedCount = rideChecks.filter(item => plan.checked.includes(item.id)).length;
          const open = expanded === plan.id;
          return (
            <article key={plan.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              <button type="button" onClick={() => setExpanded(open ? undefined : plan.id)} aria-expanded={open}
                className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-zinc-800/60 sm:px-5">
                <span className="rounded-xl bg-orange-500/10 p-3 text-orange-400"><CalendarDays aria-hidden="true" className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-lg font-bold">{plan.title}</span>
                  <span className="mt-1 block text-sm text-zinc-400">{formatRideDate(plan.startsAt)}</span>
                </span>
                <ChevronRight aria-hidden="true" className={open ? 'size-5 shrink-0 rotate-90' : 'size-5 shrink-0'} />
              </button>
              {open && (
                <div className="space-y-4 border-t border-zinc-800 px-4 py-4 sm:px-5">
                  <p className="flex items-start gap-2 break-words text-sm text-zinc-200"><MapPin aria-hidden="true" className="size-4 shrink-0 text-orange-400" /><span className="min-w-0">{[plan.meetingPoint, ...plan.stops.split('\n').filter(Boolean), plan.destination].join(' → ')}</span></p>
                  {plan.notes && <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">{plan.notes}</p>}
                  <fieldset className="space-y-2 rounded-xl bg-zinc-950/70 px-3 pb-3">
                    <legend className="px-1 text-sm font-bold">Sürüş hazırlığı · {checkedCount}/{rideChecks.length}</legend>
                    {rideChecks.map(item => (
                      <label key={item.id} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" className="size-4 accent-orange-500" checked={plan.checked.includes(item.id)}
                          onChange={event => onSave({
                            ...plan,
                            checked: event.target.checked ? [...plan.checked, item.id] : plan.checked.filter(id => id !== item.id),
                            updatedAt: Date.now(),
                          })} />
                        {item.label}
                      </label>
                    ))}
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <a className={action} href={rideRouteUrl(plan)} target="_blank" rel="noreferrer"><Navigation aria-hidden="true" className="size-4" /> Rotayı aç</a>
                    <button className={action} onClick={() => downloadRideCalendar(plan)}><Clock3 aria-hidden="true" className="size-4" /> Takvime ekle</button>
                    <button className={action} onClick={() => edit(plan)}><Pencil aria-hidden="true" className="size-4" /> Düzenle</button>
                    <button className={action + ' text-red-300'} onClick={() => {
                      if (!window.confirm('Bu sürüş planı silinsin mi?') || !onDelete(plan.id)) return;
                      if (current?.id === plan.id) setEditing(undefined);
                    }}><Trash2 aria-hidden="true" className="size-4" /> Sil</button>
                  </div>
                  {groupOptions.length > 0 && (
                    <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
                      event.preventDefault();
                      const group = groups[String(new FormData(event.currentTarget).get('group'))]?.info;
                      if (group) onShare(group, formatRideMessage(plan));
                    }}>
                      <label className="min-w-32 flex-1 space-y-1 text-sm text-zinc-300">Paylaşılacak kortej
                        <select className={field} name="group" required>
                          {groupOptions.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                        </select>
                      </label>
                      <button className={action}><Send aria-hidden="true" className="size-4" /> Sohbette hazırla</button>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
