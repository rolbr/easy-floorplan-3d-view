// Visual editor: lists every Easy Floorplan card on every dashboard/view and lets the user pick one floor.

import type { HaFormDataContainer, HaFormElement, HaFormSchema, LovelaceConfigForm } from 'home-assistant-frontend-types';
import { CARD_CONFIG, FLOORPLAN_CARD_TYPE, TAG_NAMES } from '../config/constants';
import { log } from '../lib/logger';
import type { CardConfig, HomeAssistant, SourceConfig } from '../types';
import {
  DEFAULT_NORTH_MARKER,
  DEFAULT_NORTH_OFFSET,
  type EditorFormData,
  FORM_OWNED_KEYS,
  type FormOwnedConfig,
  type NorthMarkerData,
  prune,
} from './form-data';
import { HELPERS, LABELS, markerSizeLimitSchema, northSchema, STYLE } from './form-schema';
import { type CardEntry, type DashboardInfo, getAllFloorplanCards } from './load-floorplan-cards';

type CustomHaFormElement = HTMLElement & HaFormElement & LovelaceConfigForm & { hass?: HomeAssistant };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

class EasyFloorplan3DEditor extends HTMLElement {
  _hass: HomeAssistant;
  _config: CardConfig;
  _entries: CardEntry[] | null = null;
  _error: string | null = null;
  _scanning = false;
  _sourceExpanded = true;

  setConfig(config: CardConfig) {
    this._config = { ...CARD_CONFIG, ...config };
    this._render();
  }

  set hass(hass: HomeAssistant) {
    const first = !this._hass;
    this._hass = hass;
    if (this._probe) this._probe.hass = hass; // probe may have been created before hass arrived
    if (this._form) this._form.hass = hass; // keep the form's hass current on every state change
    if (first) this._scan();
  }

  connectedCallback() {
    void this._loadRadio();
  }

  private _radioReady = false;
  private _radioLoading?: Promise<void>;
  private _probe?: CustomHaFormElement;

  // Needed to use ha-radio-group outside of ha-form.
  // HA lazy-loads ha-radio-group; a hidden ha-form with a list select forces it to load.
  private _loadRadio(): Promise<void> {
    if (customElements.get('ha-radio-group')) {
      this._radioReady = true;
      return Promise.resolve();
    }
    if (!this._radioLoading) {
      const probe = document.createElement('ha-form') as CustomHaFormElement;
      probe.hass = this._hass;
      probe.schema = [{ name: 'x', selector: { select: { mode: 'list', options: ['a'] } } }];
      probe.style.display = 'none';
      document.body.appendChild(probe); // outside `this`, so innerHTML can't remove it
      this._probe = probe;
      const t0 = performance.now();
      const timeout = 5000;
      this._radioLoading = Promise.race([customElements.whenDefined('ha-radio-group'), new Promise((r) => setTimeout(r, timeout))]).then(
        () => {
          probe.remove();
          this._probe = undefined;
          this._radioReady = !!customElements.get('ha-radio-group');
          if (this._radioReady) {
            const duration = Math.round(performance.now() - t0);
            log.trace(`ha-radio-group ready after ${duration} ms; hass was ${this._hass ? 'present' : 'missing'}`);
          } else {
            log.error(`ha-radio-group not defined after ${timeout} ms; hass was ${probe.hass ? 'present' : 'missing'}`);
          }
          this._render();
        },
      );
    }
    return this._radioLoading;
  }

  private _form?: CustomHaFormElement;
  private _lastSourceHtml?: string;

  private _formSchema: HaFormSchema[] = [northSchema, markerSizeLimitSchema];

  /** Config -> form data. Fills in defaults so the inputs show effective values. */
  private _toFormData(): EditorFormData {
    const c = this._config;
    return {
      north_offset: c?.north_offset ?? DEFAULT_NORTH_OFFSET,
      north_marker: { ...DEFAULT_NORTH_MARKER, ...c?.north_marker },
      marker_size_limits: c?.marker_size_limits ?? {},
    };
  }

  /**
   * Form data -> config values. Drops defaults and empties so only real overrides are saved,
   * but keeps a default-equal value the config already contained explicitly, so an edit
   * elsewhere doesn't silently remove it (which would also leave the dialog's Save enabled).
   */
  private _fromFormData(data: EditorFormData): FormOwnedConfig {
    const cur = this._config;
    const marker = Object.fromEntries(
      Object.entries(data.north_marker ?? {}).filter(
        ([k, v]) => v !== DEFAULT_NORTH_MARKER[k as keyof NorthMarkerData] || cur?.north_marker?.[k as keyof NorthMarkerData] !== undefined,
      ),
    ) as FormOwnedConfig['north_marker'];
    const offsetIsDefault = data.north_offset === DEFAULT_NORTH_OFFSET && cur?.north_offset === undefined;
    return {
      north_offset: offsetIsDefault ? undefined : data.north_offset,
      north_marker: prune(marker),
      marker_size_limits: prune(data.marker_size_limits),
    };
  }

  private _ensureForm() {
    if (!this._form) {
      const f = document.createElement('ha-form') as HTMLElement & HaFormElement & LovelaceConfigForm;
      f.schema = this._formSchema;
      f.computeLabel = (s: { name: string }) => LABELS[s.name] ?? s.name;
      f.computeHelper = (s: { name: string }) => HELPERS[s.name];
      f.addEventListener('value-changed', (ev: CustomEvent<{ value: EditorFormData }>) => {
        ev.stopPropagation();
        const owned = this._fromFormData(ev.detail.value);
        const config: CardConfig = { ...this._config };
        for (const key of FORM_OWNED_KEYS) {
          if (owned[key] === undefined) delete config[key];
          else (config as Record<string, unknown>)[key] = owned[key];
        }
        this.dispatchEvent(
          new CustomEvent('config-changed', {
            detail: { config },
            bubbles: true,
            composed: true,
          }),
        );
      });
      this._form = f;
    }
    this._form.hass = this._hass;
    // HaFormData lacks nested objects, i.e. for type:expandable, yet ha-form handles them fine at runtime.
    this._form.data = this._toFormData() as unknown as HaFormDataContainer;
  }

  async _scan() {
    if (this._scanning || !this._hass?.connection) return;
    this._scanning = true;
    this._error = null;
    this._render();
    try {
      this._entries = await getAllFloorplanCards(this._hass);
    } catch (e) {
      this._error = String((e as Error)?.message ?? e);
    }
    this._scanning = false;
    this._render();
  }

  _isSelected(entry: CardEntry, floorId: string, areaId?: string) {
    const s = this._config?.source;
    return (
      !!s &&
      s.floor_id === floorId &&
      (areaId === undefined ? !s.area_id : s.area_id === areaId) &&
      (s.dashboard ?? null) === entry.dashboard.url_path &&
      s.view === entry.viewPath &&
      (entry.cardCount < 2 || (s.card_index ?? 0) === entry.cardIndex)
    );
  }

  _select(entry: CardEntry, floorId: string, areaId?: string) {
    const source: SourceConfig = {
      card_type: FLOORPLAN_CARD_TYPE,
      view: entry.viewPath,
      floor_id: floorId,
      ...(areaId ? { area_id: areaId } : {}),
    };
    if (entry.cardCount > 1) source.card_index = entry.cardIndex;
    if (entry.dashboard.url_path) source.dashboard = entry.dashboard.url_path;

    const config: CardConfig = { ...this._config, source };
    this._config = config;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
    this._render();
  }

  _render() {
    const status = this._scanning
      ? '<div class="hint">Scanning dashboards…</div>'
      : this._error
        ? `<div class="err">${esc(this._error)}</div>`
        : '';

    const renderFloors = (e: CardEntry) => {
      if (!e.floors.length) return '<div class="hint">No floors in this card.</div>';
      if (!this._radioReady) return '<div class="hint">Loading…</div>';
      let value = '';
      for (const f of e.floors) {
        if (this._isSelected(e, f.id)) value = `${f.id}|`;
        for (const a of f.areas) if (this._isSelected(e, f.id, a.id)) value = `${f.id}|${a.id}`;
      }
      return `
        <ha-radio-group data-key="${esc(e.key)}" value="${esc(value)}">
          ${e.floors
            .map(
              (f) => `
            <ha-radio-option class="floor" value="${esc(f.id)}|" data-floor="${esc(f.id)}">
              ${esc(f.name)} <span class="meta">· id <em>${esc(f.id)}</em></span>
            </ha-radio-option>
            ${f.areas
              .map(
                (a) => `
              <ha-radio-option class="area" value="${esc(f.id)}|${esc(a.id)}" data-floor="${esc(f.id)}" data-area="${esc(a.id)}">
                ${esc(a.name)} <span class="meta">· id <em>${esc(a.id)}</em></span>
              </ha-radio-option>`,
              )
              .join('')}`,
            )
            .join('')}
        </ha-radio-group>`;
    };

    // dashboard id -> view index -> cards
    const tree = new Map<string, { dashboard: DashboardInfo; views: Map<number, CardEntry[]> }>();
    for (const e of this._entries ?? []) {
      let d = tree.get(e.dashboard.id);
      if (!d) {
        d = { dashboard: e.dashboard, views: new Map() };
        tree.set(e.dashboard.id, d);
      }
      const list = d.views.get(e.viewIndex) ?? [];
      list.push(e);
      d.views.set(e.viewIndex, list);
    }

    const cards = [...tree.values()]
      .map(({ dashboard, views }) => {
        const viewsHtml = [...views.values()]
          .map((cardsInView) => {
            const v = cardsInView[0];
            const viewHasMultipleCards = v.cardCount > 1;
            const cardsHtml = cardsInView
              .map(
                (e) => `
              <div class="card">
                ${viewHasMultipleCards ? `<div class="headline-meta"><h6>Card</h6><span class="meta">· <em>${e.cardIndex + 1}</em> of ${e.cardCount}</span></div>` : ''}
                ${renderFloors(e)}
              </div>`,
              )
              .join('');
            return `
            <div class="view">
              <div class="headline-meta">
                <h5>${esc(v.viewTitle)}</h5>
                <div class="meta">· url <em>${esc(v.viewPath)}</em> · id <em>${v.viewIndex}</em></div>
              </div>
              ${
                v.viewHasPath
                  ? ''
                  : '<div class="warn">⚠️ This view has no <code>path</code> and will be fetched via numeric index. The index may change and require re-configuration. <strong>Tip:</strong> Set a <code>path</code> on the view.</div>'
              }
              ${
                viewHasMultipleCards
                  ? '<div class="warn">⚠️ Cards will be fetched via numeric index. Moving a card may change its index and require re-configuration. <strong>Tip:</strong> Only have a single card on a view.</div>'
                  : ''
              }
              ${cardsHtml}
            </div>`;
          })
          .join('');
        return `
          <div class="dash">
            <div class="headline-meta">
              <h4>${esc(dashboard.title)}</h4>
              <div class="meta">· url <em>${esc(dashboard.url_path ?? '(default)')}</em> · id <em>${esc(dashboard.id)}</em></div>
            </div>
            ${viewsHtml}
          </div>`;
      })
      .join('');

    const empty =
      !this._scanning && this._entries && !this._entries.length
        ? `<div class="hint">No <code>${esc(FLOORPLAN_CARD_TYPE)}</code> cards found.</div>`
        : '';

    // Build the skeleton once. Only #source is rebuilt on later renders, so the
    // ha-form is never detached from the DOM (detaching it would blur the focused input).
    if (!this.querySelector('#form')) {
      this.innerHTML = `
        ${STYLE}
        <div id="source"></div>
        <div id="form"></div>
      `;
    }

    const sourceHtml = `
      <ha-expansion-panel outlined id="source-panel" header="Source"
        ${this._sourceExpanded ? 'expanded' : ''}>
        <ha-button id="rescan" appearance="filled" size="xs">Rescan dashboards</ha-button>
        ${status}${cards}${empty}
      </ha-expansion-panel>
    `;

    // Rebuild #source only when its markup changed. Skipping identical renders avoids
    // flicker and keeps scroll/expansion state while typing in the form below.
    if (sourceHtml !== this._lastSourceHtml) {
      this._lastSourceHtml = sourceHtml;
      (this.querySelector('#source') as HTMLElement).innerHTML = sourceHtml;

      this.querySelector('#source-panel')?.addEventListener('expanded-changed', (e: Event) => {
        this._sourceExpanded = (e as CustomEvent).detail.expanded;
      });
      this.querySelector('#rescan')?.addEventListener('click', () => this._scan());
      this.querySelectorAll<HTMLElement>('ha-radio-group').forEach((group) => {
        const entry = () => this._entries?.find((x) => x.key === group.dataset.key);
        const onChange = (ev: Event) => {
          // webawesome-based groups emit native 'change'; value is on the group, not necessarily in detail
          // biome-ignore lint/suspicious/noExplicitAny: ""
          const v = ((ev as CustomEvent).detail?.value ?? (group as any).value) as string | undefined;
          if (!v) return;
          const [floorId, areaId] = v.split('|');
          const en = entry();
          if (!en || !floorId) return;
          if (this._isSelected(en, floorId, areaId || undefined)) return; // dedupe change + value-changed
          this._select(en, floorId, areaId || undefined);
        };
        group.addEventListener('change', onChange);
        group.addEventListener('value-changed', onChange);
        // clicking an already selected area falls back to its floor
        group.querySelectorAll<HTMLElement>('ha-radio-option.area').forEach((opt) => {
          opt.addEventListener('click', () => {
            const en = entry();
            const { floor, area } = opt.dataset;
            if (en && floor && area && this._isSelected(en, floor, area)) this._select(en, floor);
          });
        });
      });
    }

    this._ensureForm();
    const formHost = this.querySelector('#form');
    if (this._form && this._form.parentElement !== formHost) {
      formHost?.appendChild(this._form); // first render only
    }
  }
}

customElements.define(TAG_NAMES.editor, EasyFloorplan3DEditor);
