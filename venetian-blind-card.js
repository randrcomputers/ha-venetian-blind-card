/**
 * Venetian Blind Card for Home Assistant Lovelace.
 * Lift: raise / lower the blind. Tilt: close slats or set horizontal.
 * 0 = slats closed, 50+ = horizontal. State is optimistic (last command).
 */
(function () {
  const DEFAULT_SLAT = [196, 146, 79];
  const DEFAULT_FRAME = [107, 83, 64];

  function toRgb(color, fallback) {
    if (Array.isArray(color) && color.length >= 3) {
      const rgb = color.slice(0, 3).map(Number);
      if (rgb.every(Number.isFinite)) return rgb;
    }
    if (typeof color === "string") {
      const s = color.trim();
      if (s.startsWith("rgb")) {
        const m = s.match(/\d+/g);
        if (m && m.length >= 3) return m.slice(0, 3).map(Number);
      }
      if (s[0] === "#") {
        let hex = s.slice(1);
        if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
        if (hex.length === 6) {
          return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
          ];
        }
      }
      const csv = s.split(",").map((n) => Number(n.trim()));
      if (csv.length >= 3 && csv.every(Number.isFinite)) return csv;
    }
    return fallback.slice();
  }

  function mixRgb(rgb, toward, t) {
    return rgb.map((c, i) => Math.round(c + (toward[i] - c) * t));
  }

  function rgbCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function boot() {
    if (!customElements.get("ha-panel-lovelace") && !customElements.get("hui-view")) {
      setTimeout(boot, 100);
      return;
    }
    const LitElement = Object.getPrototypeOf(
      customElements.get("ha-panel-lovelace") || customElements.get("hui-view")
    );
    const { html, css } = LitElement.prototype;

    class VenetianBlindCard extends LitElement {
      static get properties() {
        return {
          hass: {},
          _config: { state: true },
          _drag: { state: true },
        };
      }

      static getConfigElement() {
        return document.createElement("venetian-blind-card-editor");
      }

      static getStubConfig() {
        return {
          name: "Living room",
          subtitle: "Venetian blind",
          entity: "input_number.living_room_tilt",
          state_entity: "input_text.living_room_tilt_state",
          cover_entity: "cover.living_room_blind",
          slat_color: [196, 146, 79],
          frame_color: [107, 83, 64],
        };
      }

      setConfig(config) {
        if (!config || !config.entity) {
          throw new Error("Set entity to the tilt slider input_number");
        }
        this._config = config;
      }

      getCardSize() {
        return 4;
      }

      _num(entityId) {
        const st = this.hass?.states?.[entityId];
        const n = Number(st?.state);
        return Number.isFinite(n) ? n : 0;
      }

      _last() {
        return this.hass?.states?.[this._config.state_entity]?.state || "";
      }

      _raised() {
        return this._last() === "up";
      }

      _pos() {
        if (this._drag != null) return this._drag;
        return this._num(this._config.entity);
      }

      _label(pos) {
        if (this._raised()) return "Open";
        if (pos < 50) return "Closed";
        return "Horizontal";
      }

      _angle(pos) {
        const t = Math.min(50, Math.max(0, pos)) / 50;
        return 78 * (1 - t);
      }

      _remember(value) {
        if (!this._config.state_entity) return;
        this.hass.callService("input_text", "set_value", {
          entity_id: this._config.state_entity,
          value,
        });
      }

      _set(value) {
        const v = Math.round(Number(value));
        this._drag = v;
        this.hass.callService("input_number", "set_value", {
          entity_id: this._config.entity,
          value: v,
        });
        this._remember(v < 50 ? "0" : "100");
        if (this._config.cover_entity) {
          if (v < 50) {
            this.hass.callService("cover", "close_cover", {
              entity_id: this._config.cover_entity,
            });
          } else {
            this.hass.callService("cover", "open_cover_tilt", {
              entity_id: this._config.cover_entity,
            });
          }
        }
      }

      _lift(dir) {
        if (!this._config.cover_entity) return;
        if (dir === "open") {
          this._remember("up");
          this.hass.callService("cover", "open_cover", {
            entity_id: this._config.cover_entity,
          });
          return;
        }
        const pos = this._pos();
        this._remember(pos < 50 ? "0" : "100");
        this.hass.callService("cover", "close_cover", {
          entity_id: this._config.cover_entity,
        });
      }

      _onInput(ev) {
        this._drag = Number(ev.target.value);
      }

      _onChange(ev) {
        this._set(ev.target.value);
        this._drag = null;
      }

      render() {
        if (!this._config || !this.hass) return html``;
        const pos = this._pos();
        const raised = this._raised();
        const angle = this._angle(pos);
        const openAmt = raised ? 1 : Math.min(50, Math.max(0, pos)) / 50;
        const name = this._config.name || "Venetian blind";
        const subtitle = this._config.subtitle;
        const slats = Array.from({ length: 12 }, (_, i) => i);
        const badgeClass = raised ? "open" : pos < 50 ? "closed" : "open";
        const slatRgb = toRgb(this._config.slat_color, DEFAULT_SLAT);
        const frameRgb = toRgb(this._config.frame_color, DEFAULT_FRAME);
        const slatLight = mixRgb(slatRgb, [255, 255, 255], 0.32);
        const slatDark = mixRgb(slatRgb, [0, 0, 0], 0.38);
        const frameInner = mixRgb(frameRgb, [0, 0, 0], 0.42);
        const slatH = 18 - openAmt * 10;
        const slatOverlap = -6 + openAmt * 12;
        const winStyle = [
          `--open:${openAmt}`,
          `--angle:${angle}deg`,
          `--slat-h:${slatH}px`,
          `--slat-overlap:${slatOverlap}px`,
          `--slat-face:linear-gradient(180deg, ${rgbCss(slatLight)} 0%, ${rgbCss(slatRgb)} 46%, ${rgbCss(slatDark)} 100%)`,
          `--frame-color:${rgbCss(frameRgb)}`,
          `--frame-inner:${rgbCss(frameInner)}`,
        ].join(";");

        return html`
          <ha-card>
            <div class="wrap">
              <div class="head">
                <div>
                  <div class="name">${name}</div>
                  ${subtitle ? html`<div class="sub">${subtitle}</div>` : ""}
                </div>
                <div class="badge ${badgeClass}">${this._label(pos)}</div>
              </div>

              <div class="stage">
                <div class="window ${raised ? "raised" : ""}" style=${winStyle}>
                  <div class="glass"></div>
                  <div class="pane">
                    ${slats.map(() => html`<div class="slat"></div>`)}
                  </div>
                  <div class="frame"></div>
                </div>
                <div class="readout">
                  <div class="section-label">Lift</div>
                  <button class="arrow" title="Raise blind" @click=${() => this._lift("open")}>
                    <span class="chev">▲</span>
                    <span>Raise</span>
                  </button>
                  <div class="pct">${raised ? "Open" : `${Math.round(pos)}%`}</div>
                  <div class="status">${raised ? "Raised" : this._label(pos)}</div>
                  <button class="arrow" title="Lower blind" @click=${() => this._lift("close")}>
                    <span class="chev">▼</span>
                    <span>Lower</span>
                  </button>
                </div>
              </div>

              <div class="section-label tilt-label">Tilt slats</div>
              <input
                class="slider"
                type="range"
                min="0"
                max="100"
                step="1"
                .value=${String(Math.round(pos))}
                @input=${this._onInput}
                @change=${this._onChange}
              />

              <div class="btns">
                <button class="btn" @click=${() => this._set(0)}>Close slats</button>
                <button class="btn primary" @click=${() => this._set(50)}>Horizontal</button>
              </div>
            </div>
          </ha-card>
        `;
      }

      static get styles() {
        return css`
          ha-card {
            overflow: hidden;
            background: linear-gradient(180deg, #2a2d33 0%, #1c1e22 100%);
          }
          :host {
            display: block;
          }
          .wrap {
            box-sizing: border-box;
            padding: 14px 12px 12px;
          }
          .head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
          }
          .name {
            font-size: 1.15rem;
            font-weight: 650;
            letter-spacing: 0.01em;
          }
          .sub {
            color: var(--secondary-text-color);
            font-size: 0.8rem;
            margin-top: 2px;
          }
          .badge {
            border-radius: 999px;
            padding: 5px 12px;
            font-size: 0.78rem;
            font-weight: 650;
            white-space: nowrap;
          }
          .badge.closed {
            background: #3a3228;
            color: #e6c089;
          }
          .badge.open {
            background: #243528;
            color: #9ad4a6;
          }
          .stage {
            display: grid;
            grid-template-columns: minmax(0, 1.15fr) minmax(92px, 0.85fr);
            gap: 10px;
            align-items: center;
            margin: 14px 0 8px;
          }
          .window {
            position: relative;
            width: 100%;
            height: 168px;
            border-radius: 0;
            background: #87a6c4;
            box-shadow: inset 0 0 0 8px var(--frame-color, #6b5340),
              inset 0 0 0 10px var(--frame-inner, #3d2e24);
            overflow: hidden;
          }
          .glass {
            position: absolute;
            inset: 10px;
            background: linear-gradient(180deg, #9ec0e4 0%, #e7f3ff 50%, #b9d2ea 100%);
          }
          .pane {
            position: absolute;
            inset: 10px;
            z-index: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          .slat {
            flex: 0 0 var(--slat-h, 20px);
            width: 100%;
            margin-top: var(--slat-overlap, -7px);
            border-radius: 0;
            background: var(--slat-face);
            box-shadow: 0 1px 0 rgba(255, 255, 255, 0.28) inset,
              0 1px 2px rgba(0, 0, 0, 0.35);
            transform: scaleY(calc(0.7 + (1 - var(--open)) * 0.3));
            transform-origin: center center;
            transition: transform 0.25s ease, opacity 0.25s ease, margin 0.25s ease,
              flex-basis 0.25s ease;
          }
          .slat:first-child {
            margin-top: 0;
          }
          .window.raised .slat {
            opacity: 0;
            transform: translateY(-120%) scaleY(0.2);
          }
          .frame {
            pointer-events: none;
            position: absolute;
            inset: 0;
            box-shadow: inset 0 0 0 8px var(--frame-color, #6b5340);
            border-radius: 0;
          }
          .readout {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 6px;
            min-width: 0;
            width: 100%;
          }
          .readout .pct {
            font-size: 2.2rem;
            font-weight: 700;
            line-height: 1;
          }
          .readout .status {
            color: var(--secondary-text-color);
            font-size: 1rem;
            font-weight: 600;
          }
          .section-label {
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--secondary-text-color);
          }
          .tilt-label {
            margin: 4px 0 0;
          }
          .arrow {
            appearance: none;
            border: 0;
            box-sizing: border-box;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            height: 34px;
            padding: 0 6px;
            border-radius: 10px;
            background: #3a3d44;
            color: #f3f3f3;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 0.78rem;
            font-weight: 650;
          }
          .arrow .chev {
            font-size: 0.85rem;
            line-height: 1;
          }
          .arrow:hover {
            background: #4a4e57;
          }
          .slider {
            width: 100%;
            margin: 6px 0 12px;
            accent-color: #d4a25a;
          }
          .btns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .btn {
            appearance: none;
            border: 0;
            border-radius: 10px;
            padding: 10px 12px;
            font-weight: 650;
            cursor: pointer;
            background: #3a3d44;
            color: #f3f3f3;
          }
          .btn.primary {
            background: #c7923e;
            color: #1b140c;
          }
        `;
      }
    }

    class VenetianBlindCardEditor extends LitElement {
      static get properties() {
        return {
          hass: {},
          _config: { state: true },
        };
      }

      setConfig(config) {
        this._config = config;
      }

      _schema() {
        return [
          { name: "name", selector: { text: {} } },
          { name: "subtitle", selector: { text: {} } },
          { name: "entity", selector: { entity: { domain: "input_number" } } },
          { name: "state_entity", selector: { entity: { domain: "input_text" } } },
          { name: "cover_entity", selector: { entity: { domain: "cover" } } },
          { name: "slat_color", selector: { color_rgb: {} } },
          { name: "frame_color", selector: { color_rgb: {} } },
        ];
      }

      _computeLabel(schema) {
        const labels = {
          name: "Name",
          subtitle: "Subtitle",
          entity: "Tilt slider (input_number)",
          state_entity: "Last command (input_text)",
          cover_entity: "Blind cover",
          slat_color: "Slat color",
          frame_color: "Window frame color",
        };
        return labels[schema.name] || schema.name;
      }

      _valueChanged(ev) {
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: ev.detail.value },
            bubbles: true,
            composed: true,
          })
        );
      }

      render() {
        if (!this.hass || !this._config) return html``;
        return html`
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${this._schema()}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        `;
      }
    }

    if (!customElements.get("venetian-blind-card-editor")) {
      customElements.define("venetian-blind-card-editor", VenetianBlindCardEditor);
    }
    if (!customElements.get("venetian-blind-card")) {
      customElements.define("venetian-blind-card", VenetianBlindCard);
    }
    if (!customElements.get("bond-tilt-card")) {
      customElements.define("bond-tilt-card", class extends VenetianBlindCard {});
    }
    window.customCards = window.customCards || [];
    if (!window.customCards.some((c) => c.type === "venetian-blind-card")) {
      window.customCards.push({
        type: "venetian-blind-card",
        name: "Venetian Blind Card",
        description: "Lift and tilt a venetian blind with a slat graphic",
        preview: true,
      });
    }
  }
  boot();
})();
