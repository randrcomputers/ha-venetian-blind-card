# Venetian Blind Card

Lovelace card for venetian blinds with **lift** (raise / lower) and **tilt slats** (closed / horizontal).

Pick slat color and square window-frame color in the visual editor. Closed slats overlap and fill the pane.

For each blind you need:

1. A `cover` entity
2. An `input_number` slider (0–100) for tilt
3. An `input_text` helper to remember the last command (recommended)

One-way motors (Bond and similar) cannot report live slat position. The card shows last command, not a sensor reading.
