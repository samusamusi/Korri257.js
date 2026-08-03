(function () {
    const old = document.getElementById('sam-attack-planner');
    if (old) old.remove();

    const game = window.game_data || {};
    const worldSpeed = Number(game.speed) || 1;
    const unitSpeed = Number(game.unit_speed) || 1;

    const units = {
        spy: ['Späher', 9],
        light: ['Leichte Kavallerie', 10],
        heavy: ['Schwere Kavallerie', 11],
        spear: ['Speer/Axt', 18],
        sword: ['Schwertkämpfer', 22],
        ram: ['Rammbock/Katapult', 30],
        snob: ['Adelsgeschlecht', 35]
    };

    function getCoordinate(value) {
        const match = String(value).match(/(\d{1,3})\s*\|\s*(\d{1,3})/);
        return match ? [Number(match[1]), Number(match[2])] : null;
    }

    function findVillageCoordinates() {
        const found = new Set();

        document.querySelectorAll('a[href*="village="]').forEach(link => {
            const row = link.closest('tr');
            const text = row ? row.textContent : link.textContent;
            const matches = text.match(/\b\d{1,3}\|\d{1,3}\b/g) || [];

            matches.forEach(coord => found.add(coord));
        });

        if (!found.size) {
            const matches =
                document.body.innerText.match(/\b\d{1,3}\|\d{1,3}\b/g) || [];

            matches.forEach(coord => found.add(coord));
        }

        return [...found];
    }

    function formatDate(date) {
        return date.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function formatDuration(seconds) {
        seconds = Math.round(seconds);

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return (
            hours +
            'h ' +
            String(minutes).padStart(2, '0') +
            'm ' +
            String(secs).padStart(2, '0') +
            's'
        );
    }

    const panel = document.createElement('div');
    panel.id = 'sam-attack-planner';
    panel.style.cssText =
        'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
        'z-index:999999;width:min(760px,94vw);max-height:90vh;overflow:auto;' +
        'background:#f4e4bc;border:3px solid #7d510f;padding:16px;' +
        'color:#4b2e0c;font:14px Arial;box-shadow:0 5px 20px #0009;';

    panel.innerHTML = `
        <div style="font-size:24px;font-weight:bold;margin-bottom:14px">
            Angriffsplaner
            <span id="sap-close"
                  style="float:right;cursor:pointer;margin-left:20px">×</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label>
                Zielkoordinate
                <input id="sap-target"
                       placeholder="500|500"
                       style="box-sizing:border-box;width:100%;padding:8px;margin-top:4px">
            </label>

            <label>
                Langsamste Einheit
                <select id="sap-unit"
                        style="box-sizing:border-box;width:100%;padding:8px;margin-top:4px">
                    ${Object.entries(units)
                        .map(([key, unit]) =>
                            `<option value="${key}">${unit[0]} – ${unit[1]} Min./Feld</option>`
                        )
                        .join('')}
                </select>
            </label>

            <label style="grid-column:1/-1">
                Gewünschte Einschlagzeit
                <input id="sap-arrival"
                       type="datetime-local"
                       step="1"
                       style="box-sizing:border-box;width:100%;padding:8px;margin-top:4px">
            </label>

            <label style="grid-column:1/-1">
                Eigene Startdörfer
                <textarea id="sap-sources"
                          rows="8"
                          placeholder="Eine Koordinate pro Zeile"
                          style="box-sizing:border-box;width:100%;padding:8px;margin-top:4px"></textarea>
            </label>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
            <button id="sap-detect" type="button" style="padding:8px 12px">
                Eigene Dörfer einlesen
            </button>

            <button id="sap-calculate" type="button"
                    style="padding:8px 12px;font-weight:bold">
                Plan berechnen
            </button>

            <button id="sap-copy" type="button"
                    style="display:none;padding:8px 12px">
                Plan kopieren
            </button>
        </div>

        <div style="font-size:12px;margin-bottom:10px">
            Weltgeschwindigkeit: ${worldSpeed} ·
            Einheitengeschwindigkeit: ${unitSpeed}
        </div>

        <div id="sap-message"></div>
        <div id="sap-results"></div>
    `;

    document.body.appendChild(panel);

    const element = id => document.getElementById(id);
    let copyText = '';

    element('sap-close').onclick = () => panel.remove();

    element('sap-detect').onclick = () => {
        const coordinates = findVillageCoordinates();

        element('sap-sources').value = coordinates.join('\n');
        element('sap-message').innerHTML =
            '<b>' +
            coordinates.length +
            ' Koordinaten gefunden.</b> Prüfe kurz, ob nur eigene Dörfer enthalten sind.';
    };

    element('sap-calculate').onclick = () => {
        const target = getCoordinate(element('sap-target').value);
        const arrival = new Date(element('sap-arrival').value);
        const selectedUnit = units[element('sap-unit').value];

        if (!target) {
            alert('Bitte eine gültige Zielkoordinate eingeben, zum Beispiel 500|500.');
            return;
        }

        if (Number.isNaN(arrival.getTime())) {
            alert('Bitte eine gültige Einschlagzeit eingeben.');
            return;
        }

        const sourceMatches =
            element('sap-sources').value.match(/\b\d{1,3}\s*\|\s*\d{1,3}\b/g) || [];

        const uniqueSources = [...new Set(
            sourceMatches.map(coord => coord.replace(/\s/g, ''))
        )];

        const sources = uniqueSources
            .map(getCoordinate)
            .filter(Boolean);

        if (!sources.length) {
            alert('Keine Startdörfer gefunden.');
            return;
        }

        const rows = sources.map(source => {
            const distance = Math.hypot(
                source[0] - target[0],
                source[1] - target[1]
            );

            const travelSeconds =
                distance *
                selectedUnit[1] *
                60 /
                (worldSpeed * unitSpeed);

            const sendTime = new Date(
                arrival.getTime() - travelSeconds * 1000
            );

            return {
                source: source.join('|'),
                distance,
                travelSeconds,
                sendTime
            };
        });

        rows.sort((a, b) => a.sendTime - b.sendTime);

        copyText =
            '[b]Angriffsplan auf ' + target.join('|') + '[/b]\n' +
            'Einschlag: ' + formatDate(arrival) + '\n' +
            'Einheit: ' + selectedUnit[0] + '\n\n' +
            rows.map(row =>
                formatDate(row.sendTime) +
                ' | ' +
                row.source +
                ' → ' +
                target.join('|') +
                ' | Laufzeit: ' +
                formatDuration(row.travelSeconds)
            ).join('\n');

        element('sap-results').innerHTML = `
            <table style="width:100%;border-collapse:collapse;background:#fff4d4">
                <thead>
                    <tr>
                        <th style="padding:7px;border:1px solid #9b7438">Startdorf</th>
                        <th style="padding:7px;border:1px solid #9b7438">Entfernung</th>
                        <th style="padding:7px;border:1px solid #9b7438">Laufzeit</th>
                        <th style="padding:7px;border:1px solid #9b7438">Absendezeit</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td style="padding:7px;border:1px solid #9b7438">
                                ${row.source}
                            </td>
                            <td style="padding:7px;border:1px solid #9b7438">
                                ${row.distance.toFixed(2)}
                            </td>
                            <td style="padding:7px;border:1px solid #9b7438">
                                ${formatDuration(row.travelSeconds)}
                            </td>
                            <td style="padding:7px;border:1px solid #9b7438;font-weight:bold">
                                ${formatDate(row.sendTime)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        element('sap-message').innerHTML =
            '<b>' + rows.length + ' Angriffe berechnet.</b>';

        element('sap-copy').style.display = 'inline-block';
    };

    element('sap-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(copyText);
            alert('Angriffsplan wurde kopiert.');
        } catch (error) {
            prompt('Angriffsplan kopieren:', copyText);
        }
    };

    const detected = findVillageCoordinates();

    if (detected.length) {
        element('sap-sources').value = detected.join('\n');
        element('sap-message').innerHTML =
            '<b>' + detected.length + ' Koordinaten automatisch gefunden.</b>';
    }
})();
