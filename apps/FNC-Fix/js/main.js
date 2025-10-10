// Global state
let currentData = null;
let currentFilename = '';
let maxDrawingLength = 12;
let maxPositionLength = 12;
let referenceProfile = null;
let referenceMaterial = null;
let originalFileContent = '';
let duplicateBars = false;

// Parse FNC file content
function parseFNC(content) {
    const data = {
        profiles: [],
        materials: [],
        pieces: [],
        bars: []
    };

    const lines = content.split('\n').map(line => line.trim());
    let currentBlock = null;
    let currentPiece = null;
    let currentBar = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('[[PRF]]')) {
            currentBlock = 'PRF';
        } else if (line.startsWith('[[MAT]]')) {
            currentBlock = 'MAT';
        } else if (line.startsWith('[[PCS]]')) {
            currentBlock = 'PCS';
            currentPiece = {};
        } else if (line.startsWith('[[BAR]]')) {
            currentBlock = 'BAR';
            currentBar = { pieces: [] };
        } else if (line.startsWith('[PRF]') && currentBlock === 'PRF') {
            data.profiles.push(parseProfile(line));
        } else if (line.startsWith('[MAT]') && currentBlock === 'MAT') {
            data.materials.push(parseMaterial(line));
        } else if (line.startsWith('[HEAD]') && currentBlock === 'PCS') {
            let headerLines = [line];
            let j = i + 1;
            while (j < lines.length && lines[j] && !lines[j].startsWith('[') && !lines[j].startsWith('[[')) {
                headerLines.push(lines[j]);
                j++;
            }
            currentPiece = parsePieceHeader(headerLines.join(' '));
        } else if (line.startsWith('[HEAD]') && currentBlock === 'BAR') {
            let headerLines = [];
            let j = i + 1;
            while (j < lines.length && lines[j] && !lines[j].startsWith('[PCS]') && !lines[j].startsWith('[[')) {
                headerLines.push(lines[j]);
                j++;
            }
            currentBar = parseBarHeader(headerLines.join(' '));
            currentBar.pieces = [];
        } else if (line.startsWith('[PCS]') && currentBlock === 'BAR' && currentBar) {
            let j = i + 1;
            let pieceLines = [line];
            while (j < lines.length && lines[j] && !lines[j].startsWith('[[')) {
                if (lines[j].trim()) {
                    pieceLines.push(lines[j]);
                }
                j++;
            }
            currentBar.pieces = parseBarPieces(pieceLines.join(' '));
            currentBar.hash = hashBar(currentBar);
            data.bars.push(currentBar);
            currentBar = null;
        } else if (currentPiece && line === '' && currentBlock === 'PCS') {
            if (Object.keys(currentPiece).length > 0) {
                data.pieces.push(currentPiece);
                currentPiece = {};
            }
        }
    }

    if (currentPiece && Object.keys(currentPiece).length > 0) {
        data.pieces.push(currentPiece);
    }

    return data;
}

// Hash function for bars
function hashBar(bar) {
  // Sort and hash the pieces array
  const piecesHash = bar.pieces
    ? bar.pieces
        .map(piece => [
          piece.project || '',
          piece.drawing || '',
          piece.mark || '',
          piece.position || '',
          piece.quantity || ''
        ].join('|'))
        .sort()
        .join('||')
    : '';
  
  // Create a string from all properties
  const hashString = [
    bar.material || '',
    bar.profileType || '',
    bar.profile || '',
    bar.length || '',
    bar.quantity || '',
    bar.data || '',
    piecesHash
  ].join('###');
  
  // djb2 algorithm
  let hash = 5381;
  for (let i = 0; i < hashString.length; i++) {
    hash = ((hash << 5) + hash) + hashString.charCodeAt(i); // hash * 33 + c
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return hash.toString(36); // Convert to base-36 for shorter string
}

function groupSimilarBars() {
    const barGroups = new Map();
    currentData.bars.forEach(bar => {
        const hash = bar.hash;
        if (!barGroups.has(hash)) {
            barGroups.set(hash, {bar : bar, totalQuantity: 0 });
        }
        const group = barGroups.get(hash);
        group.totalQuantity += (bar.quantity || 0);
    });
    
    return barGroups;
}

function parseProfile(line) {
    const profile = {};
    const matches = {
        cp: line.match(/CP:(\S+)/),
        p: line.match(/(?<!C)P:([^\s]+)/),
        sa: line.match(/SA([\d.]+)/),
        ta: line.match(/TA([\d.]+)/),
        sb: line.match(/SB([\d.]+)/),
        tb: line.match(/TB([\d.]+)/),
        wl: line.match(/WL([\d.]+)/)
    };

    if (matches.cp) profile.profileType = matches.cp[1];
    if (matches.p) profile.profile = matches.p[1];
    if (matches.sa) profile.height = parseFloat(matches.sa[1]);
    if (matches.ta) profile.webThickness = parseFloat(matches.ta[1]);
    if (matches.sb) profile.width = parseFloat(matches.sb[1]);
    if (matches.tb) profile.flangeThickness = parseFloat(matches.tb[1]);
    if (matches.wl) profile.weightPerMeter = parseFloat(matches.wl[1]);

    return profile;
}

function parseMaterial(line) {
    const match = line.match(/M:(\S+)/);
    return match ? match[1] : '';
}

function parsePieceHeader(headerText) {
    const piece = {};
    const matches = {
        c: headerText.match(/C:(\S+)/),
        d: headerText.match(/D:(\S+)/),
        n: headerText.match(/N:(\d+)/),
        pos: headerText.match(/POS:(\S+)/),
        m: headerText.match(/M:(\S+)/),
        cp: headerText.match(/CP:(\S+)/),
        p: headerText.match(/(?<!C)P:([^\s]+)/),
        lp: headerText.match(/LP([\d.]+)/),
        rai: headerText.match(/RAI([\d.]+)/),
        raf: headerText.match(/RAF([\d.]+)/),
        rbi: headerText.match(/RBI([\d.]+)/),
        rbf: headerText.match(/RBF([\d.]+)/),
        qi: headerText.match(/QI(\d+)/)
    };

    if (matches.c) piece.project = matches.c[1];
    if (matches.d) piece.drawing = matches.d[1];
    if (matches.n) piece.mark = matches.n[1];
    if (matches.pos) piece.position = matches.pos[1];
    if (matches.m) piece.material = matches.m[1];
    if (matches.cp) piece.profileType = matches.cp[1];
    if (matches.p) piece.profile = matches.p[1];
    if (matches.lp) piece.length = parseFloat(matches.lp[1]);
    if (matches.rai) piece.webStartCut = parseFloat(matches.rai[1]);
    if (matches.raf) piece.webEndCut = parseFloat(matches.raf[1]);
    if (matches.rbi) piece.flangeStartCut = parseFloat(matches.rbi[1]);
    if (matches.rbf) piece.flangeEndCut = parseFloat(matches.rbf[1]);
    if (matches.qi) piece.quantity = parseInt(matches.qi[1]);

    return piece;
}

function parseBarHeader(headerText) {
    const bar = {};
    const matches = {
        n: headerText.match(/N:(\S+)/),
        m: headerText.match(/M:(\S+)/),
        cp: headerText.match(/CP:(\S+)/),
        p: headerText.match(/(?<!C)P:([^\s]+)/),
        lb: headerText.match(/LB([\d.]+)/),
        bi: headerText.match(/BI(\d+)/),
        data: headerText.match(/BI\d+\s+(.*?)$/m)
    };

    if (matches.n) bar.name = matches.n[1];
    if (matches.m) bar.material = matches.m[1];
    if (matches.cp) bar.profileType = matches.cp[1];
    if (matches.p) bar.profile = matches.p[1];
    if (matches.lb) bar.length = parseFloat(matches.lb[1]);
    if (matches.bi) bar.quantity = parseInt(matches.bi[1]);
    if (matches.data) bar.data = matches.data[1];

    return bar;
}

function parseBarPieces(piecesText) {
    const pieces = [];
    // Regex to match pieces in bar section with optional POS
    const regex = /C:(\S+)\s+D:(\S+)\s+N:(\S+)\s+(?:POS:(\S+)\s+)?QT(\d+)/g;
    let match;

    while ((match = regex.exec(piecesText)) !== null) {
        pieces.push({
            project: match[1],
            drawing: match[2],
            mark: match[3],
            position: match[4] || null, // Handle optional POS
            quantity: parseInt(match[5])
        });
    }

    return pieces;
}

// Render functions
function renderProfiles(profiles) {
    if (profiles.length === 0) return '';

    // Reference for consistency check
    const ref = profiles[0];

    return `
        <div class="card">
            <div class="card-content">
                <span class="card-title">Profiles (${profiles.length})</span>
                ${profiles.map((p, i) => {
                    // Define mismatch before using it
                    const mismatch = i > 0 && isProfileMismatch(p, ref, true);
                    return `
                        <div class="section ${mismatch ? 'warning' : ''}">
                            <h6>Profile ${i + 1}${mismatch ? ' Mismatch with first profile' : ''}</h6>
                            <div class="data-grid">
                                <div class="data-item ${mismatch ? 'warning' : ''}">
                                    <span class="data-label">Profile Type (CP):</span>
                                    <span class="data-value">${p.profileType || '-'}</span>
                                </div>
                                <div class="data-item ${mismatch ? 'warning' : ''}">
                                    <span class="data-label">Profile (P):</span>
                                    <span class="data-value">${p.profile || '-'}</span>
                                </div>
                                <div class="data-item ${mismatch ? 'warning' : ''}">
                                    <span class="data-label">Height (SA):</span>
                                    <span class="data-value">${p.height || '-'} mm</span>
                                </div>
                                <div class="data-item ${mismatch ? 'warning' : ''}">
                                    <span class="data-label">Web Thickness (TA):</span>
                                    <span class="data-value">${p.webThickness || '-'} mm</span>
                                </div>
                                <div class="data-item ${mismatch ? 'warning' : ''}">
                                    <span class="data-label">Width (SB):</span>
                                    <span class="data-value">${p.width || '-'} mm</span>
                                </div>
                                <div class="data-item ${mismatch ? 'warning' : ''}">
                                    <span class="data-label">Flange Thickness (TB):</span>
                                    <span class="data-value">${p.flangeThickness || '-'} mm</span>
                                </div>
                                <div class="data-item ${mismatch ? 'warning' : ''}">
                                    <span class="data-label">Weight/Meter (WL):</span>
                                    <span class="data-value">${p.weightPerMeter || '-'} kg/m</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderMaterials(materials) {
    if (materials.length === 0) return '';

    return `
        <div class="card">
            <div class="card-content">
                <span class="card-title">Materials (${materials.length})</span>
                <ul class="collection">
                    ${materials.map((m, i) => {
                        const mismatch = i > 0 && m !== referenceMaterial;
                        return `
                            <li class="collection-item ${mismatch ? 'warning' : ''}">
                                Material ${i + 1}: 
                                <strong>${m}</strong>
                                ${mismatch ? 'Mismatch with first material' : ''}
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        </div>
    `;
}


function isProfileMismatch(item, ref, fullCheck = false) {
    if (!ref || !item) return false;

    return fullCheck
    ? (
        item.profileType !== ref.profileType ||
        item.profile !== ref.profile ||
        item.height !== ref.height ||
        item.webThickness !== ref.webThickness ||
        item.width !== ref.width ||
        item.flangeThickness !== ref.flangeThickness ||
        item.weightPerMeter !== ref.weightPerMeter
    )
    : (
        item.profileType !== ref.profileType ||
        item.profile !== ref.profile
    );
}

function isMaterialMismatch(item, refMat) {
    if (!refMat || !item || !item.material) return false;
    return item.material.trim() !== refMat.trim();
}

function renderPieces(pieces) {
    if (pieces.length === 0) return '';
    
    return `
        <div class="card">
            <div class="card-content">
                <span class="card-title">Pieces (${pieces.length})</span>
                ${pieces.map((p, i) => `
                    <div class="section">
                        <h6>Piece ${i + 1}</h6>
                        <div class="data-grid">
                            <div class="data-item">
                                <span class="data-label">Project (C):</span>
                                <span class="data-value">${p.project || '-'}</span>
                            </div>
                            <div class="data-item ${checkLength(p.drawing, maxDrawingLength) ? 'warning' : ''}">
                                <span class="data-label">Drawing (D):${checkLength(p.drawing, maxDrawingLength) ? 'Exceeds max length!' : ''}</span>
                                <span class="data-value">${p.drawing || '-'}</span>
                            </div>
                            <div class="data-item">
                                <span class="data-label">Mark (N):</span>
                                <span class="data-value">${p.mark || '-'}</span>
                            </div>
                            ${p.position ? `
                            <div class="data-item ${checkLength(p.position, maxPositionLength) ? 'warning' : ''}">
                                <span class="data-label">Position:${checkLength(p.position, maxPositionLength) ? 'Exceeds max length!' : ''}</span>
                                <span class="data-value">${p.position}</span>
                            </div>
                            ` : ''}
                            <div class="data-item ${isProfileMismatch(p, referenceProfile) ? 'warning' : ''}">
                                <span class="data-label">
                                    Profile Type (CP):${isProfileMismatch(p, referenceProfile) ? 'Mismatch!' : ''}
                                </span>
                                <span class="data-value">${p.profileType || '-'}</span>
                            </div>
                            <div class="data-item ${isProfileMismatch(p, referenceProfile) ? 'warning' : ''}">
                                <span class="data-label">
                                    Profile (P):${isProfileMismatch(p, referenceProfile) ? 'Mismatch!' : ''}
                                </span>
                                <span class="data-value">${p.profile || '-'}</span>
                            </div>
                            <div class="data-item ${isMaterialMismatch(p, referenceMaterial) ? 'warning' : ''}">
                                <span class="data-label">
                                    Material (M):${isMaterialMismatch(p, referenceMaterial) ? 'Mismatch!' : ''}
                                </span>
                                <span class="data-value">${p.material || '-'}</span>
                            </div>
                            <div class="data-item">
                                <span class="data-label">Length (LP):</span>
                                <span class="data-value">${p.length || '-'} mm</span>
                            </div>
                            <div class="data-item">
                                <span class="data-label">Web Start Cut (RAI):</span>
                                <span class="data-value">${p.webStartCut || '-'} deg</span>
                            </div>
                            <div class="data-item">
                                <span class="data-label">Web End Cut (RAF):</span>
                                <span class="data-value">${p.webEndCut || '-'} deg</span>
                            </div>
                            <div class="data-item">
                                <span class="data-label">Flange Start Cut (RBI):</span>
                                <span class="data-value">${p.flangeStartCut || '-'} deg</span>
                            </div>
                            <div class="data-item">
                                <span class="data-label">Flange End Cut (RBF):</span>
                                <span class="data-value">${p.flangeEndCut || '-'} deg</span>
                            </div>
                            <div class="data-item">
                                <span class="data-label">Quantity (QI):</span>
                                <span class="data-value">${p.quantity || '-'}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderBars(bars) {
    if (bars.length === 0) return '';
    
    return `
        <div class="card">
            <div class="card-content">
                <span class="card-title">Bars/Nests (${bars.length})</span>
                ${bars.map((b, i) => `
                    <div class="section ${b.unique ? '' : 'warning'}">
                        <h6>Bar ${i + 1} ${b.unique ? '' : 'Duplicate'}</h6>
                        <div class="data-grid">
                            <div class="data-item ${b.unique ? '' : 'warning'}">
                                <span class="data-label">Name (N):</span>
                                <span class="data-value">${b.name || '-'}</span>
                            </div>
                            <div class="data-item ${b.unique ? '' : 'warning'} ${isProfileMismatch(b, referenceProfile) ? 'warning' : ''}">
                                <span class="data-label">
                                    Profile Type (CP):${isProfileMismatch(b, referenceProfile) ? 'Mismatch!' : ''}
                                </span>
                                <span class="data-value">${b.profileType || '-'}</span>
                            </div>
                            <div class="data-item ${b.unique ? '' : 'warning'} ${isProfileMismatch(b, referenceProfile) ? 'warning' : ''}">
                                <span class="data-label">
                                    Profile (P):${isProfileMismatch(b, referenceProfile) ? 'Mismatch!' : ''}
                                </span>
                                <span class="data-value">${b.profile || '-'}</span>
                            </div>
                            <div class="data-item ${b.unique ? '' : 'warning'} ${isMaterialMismatch(b, referenceMaterial) ? 'warning' : ''}">
                                <span class="data-label">
                                    Material (M):${isMaterialMismatch(b, referenceMaterial) ? 'Mismatch!' : ''}
                                </span>
                                <span class="data-value">${b.material || '-'}</span>
                            </div>
                            <div class="data-item ${b.unique ? '' : 'warning'}">
                                <span class="data-label">Length (LB):</span>
                                <span class="data-value">${b.length || '-'} mm</span>
                            </div>
                            <div class="data-item ${b.unique ? '' : 'warning'}">
                                <span class="data-label">Quantity (BI):</span>
                                <span class="data-value">${b.quantity || '-'}</span>
                            </div>
                        </div>
                        ${b.pieces && b.pieces.length > 0 ? `
                            <h6 style="margin-top: 20px;">Pieces in this Bar:</h6>
                            <table class="highlight">
                                <thead>
                                    <tr>
                                        <th>Project</th>
                                        <th>Drawing</th>
                                        <th>Mark</th>
                                        <th>Position</th>
                                        <th>Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${b.pieces.map(p => `
                                        <tr>
                                            <td>${p.project}</td>
                                            <td>${p.drawing}</td>
                                            <td>${p.mark}</td>
                                            <td>${p.position ? p.position : '-'}</td>
                                            <td>${p.quantity}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function displayData(data, filename) {
    currentData = data;
    currentFilename = filename;
    referenceProfile = data.profiles.length > 0 ? data.profiles[0] : null;
    referenceMaterial = data.materials.length > 0 ? data.materials[0] : null;
    setBarsUniqueFlag();

    const filesCol = document.getElementById('files-col');
    filesCol.innerHTML = `
        <div style="padding: 20px;">
            <div class="file-header">
                <h5>${filename}</h5>
            </div>
            ${renderProfiles(data.profiles)}
            ${renderMaterials(data.materials)}
            ${renderPieces(data.pieces)}
            ${renderBars(data.bars)}
        </div>
    `;

    updateOptionsPanel();
}

function downloadModifiedFNC() {
    if (!originalFileContent) {
        M.toast({ html: 'No file loaded' });
        return;
    }

    const blob = new Blob([originalFileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename;
    a.click();
    URL.revokeObjectURL(url);

    M.toast({ html: 'Modified FNC file downloaded successfully' });
}

function handleFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        originalFileContent = content;
        const data = parseFNC(content);
        displayData(data, file.name);
    };
    reader.readAsText(file);
}

function setupEventListeners() {
    const fileInput = document.getElementById('file-input');
    const selectBtn = document.getElementById('select-file-btn');
    const filePlaceholder = document.getElementById('file-placeholder');

    selectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFile(e.target.files[0]);
            e.target.value = '';
        }
    });

    filePlaceholder.addEventListener('click', () => fileInput.click());
    
    filePlaceholder.addEventListener('dragover', (e) => {
        e.preventDefault();
        filePlaceholder.style.borderColor = '#26a69a';
        filePlaceholder.style.backgroundColor = '#e0f2f1';
    });
    
    filePlaceholder.addEventListener('dragleave', (e) => {
        e.preventDefault();
        filePlaceholder.style.borderColor = '#9e9e9e';
        filePlaceholder.style.backgroundColor = '#f5f5f5';
    });
    
    filePlaceholder.addEventListener('drop', (e) => {
        e.preventDefault();
        filePlaceholder.style.borderColor = '#9e9e9e';
        filePlaceholder.style.backgroundColor = '#f5f5f5';
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.fnc')) {
            handleFile(file);
        } else {
            M.toast({html: 'Please drop a .fnc file'});
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeOptionsPanel();
});

// Check if string length exceeds max
function checkLength(str, maxLen) {
    return str && str.length > maxLen;
}

// Update options panel
function updateOptionsPanel() {
    if (!currentData) return;
    
    const optionsCol = document.getElementById('options-col');
    
    // Count warnings
    let drawingWarnings = 0;
    let positionWarnings = 0;
    
    currentData.pieces.forEach(p => {
        if (checkLength(p.drawing, maxDrawingLength)) drawingWarnings++;
        if (checkLength(p.position, maxPositionLength)) positionWarnings++;
    });
    
    const lengthWarningHTML = (drawingWarnings > 0 || positionWarnings > 0) ? `
        <div class="warning-summary">
            ${drawingWarnings > 0 ? `<p>${drawingWarnings} drawing(s) exceed max length</p>` : ''}
            ${positionWarnings > 0 ? `<p>${positionWarnings} position(s) exceed max length</p>` : ''}
        </div>
    ` : '<div class="success-summary"><p>All fields within length limits</p></div>';
    
    const profileCheck = checkProfileConsistency(currentData);
    const materialCheck = checkMaterialConsistency(currentData);

    const profileMismatchWarningHTML = `
        ${profileCheck.mismatched
            ? `<p class="warning-summary">${profileCheck.count} profile inconsistency(s) found</p>
            <button class="btn-small purple lighten-1 waves-effect" id="fix-profiles">Fix All Profiles</button>`
            : '<p class="success-summary">All profiles consistent</p>'}
    `

    const materialMismatchWarningHTML = `
        ${materialCheck.mismatched
            ? `<p class="warning-summary">${materialCheck.count} material inconsistency(s) found</p>
            <button class="btn-small purple lighten-1 waves-effect" id="fix-materials">Fix All Materials</button>`
            : '<p class="success-summary">All materials consistent</p>'}
    `
    
    const duplicateBarsWarningHTML = `
        ${duplicateBars
            ? `<p class="warning-summary">Duplicate bars/Nests found</p>
            <button class="btn-small purple lighten-1 waves-effect" id="group-bars-btn">Group Duplicate Bars/Nests</button>`
            : '<p class="success-summary">No duplicate bars/Nests found</p>'}
    `;

    const consistencyHTML = `
        <div class="option-section consistency-section">
            <h6>Consistency Checks</h6>
            ${profileMismatchWarningHTML}
            ${materialMismatchWarningHTML}
            ${duplicateBarsWarningHTML}
        </div>
    `;

    optionsCol.innerHTML = `
        <div class="options-content">
            <h5>Options</h5>

            ${consistencyHTML}

            <div class="option-section">
                ${lengthWarningHTML}
                <h6>Max Length Settings</h6>
                <div class="input-field">
                    <label for="max-drawing-length" class="active">Max Drawing Length</label>
                    <input type="number" id="max-drawing-length" value="${maxDrawingLength}" min="1">
                </div>
                <div class="input-field">
                    <label for="max-position-length" class="active">Max Position Length</label>
                    <input type="number" id="max-position-length" value="${maxPositionLength}" min="1">
                </div>

                <h6>Text Replacements</h6>
                <div id="replacements-container">
                    <div class="replacement-item">
                        <div class="input-field">
                            <input type="text" class="find-text">
                            <label>Text</label>
                        </div>
                        <div class="input-field">
                            <input type="text" class="replace-text">
                            <label>Replace with</label>
                        </div>
                    </div>
                </div>
                <button class="btn-small waves-effect" id="add-replacement">
                    Add More
                </button>
                <button class="btn-small purple lighten-1 waves-effect" id="execute-replacements">
                    Execute Replacements
                </button>
            </div>
            <div class="option-section">
                <button class="btn waves-effect waves-light" id="download-fnc-btn">
                    Download Modified FNC
                </button>
            </div>
        </div>
    `;
    
    setupOptionsListeners();
}

// Initialize empty options panel
function initializeOptionsPanel() {
    const optionsCol = document.getElementById('options-col');
    optionsCol.innerHTML = `
        <div class="options-content">
            <h5>Options</h5>
            <p class="empty-state">Load an FNC file to see options</p>
        </div>
    `;
}

// Setup options listeners
function setupOptionsListeners() {
    // Max length inputs
    const maxDrawingInput = document.getElementById('max-drawing-length');
    const maxPositionInput = document.getElementById('max-position-length');
    
    if (maxDrawingInput) {
        maxDrawingInput.addEventListener('input', (e) => {
            maxDrawingLength = parseInt(e.target.value) || 50;
            displayData(currentData, currentFilename);
        });
    }
    
    if (maxPositionInput) {
        maxPositionInput.addEventListener('input', (e) => {
            maxPositionLength = parseInt(e.target.value) || 50;
            displayData(currentData, currentFilename);
        });
    }
    
    // Add replacement button
    const addBtn = document.getElementById('add-replacement');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const container = document.getElementById('replacements-container');
            const newItem = document.createElement('div');
            newItem.className = 'replacement-item';
            newItem.innerHTML = `
                <div class="input-field">
                    <input type="text" class="find-text">
                    <label>Text</label>
                </div>
                <div class="input-field">
                    <input type="text" class="replace-text">
                    <label>Replace with</label>
                </div>
                <button class="btn-floating red remove-replacement">
                    <strong>X</strong>
                </button>
            `;

            container.appendChild(newItem);
            
            // Add remove listener
            newItem.querySelector('.remove-replacement').addEventListener('click', () => {
                newItem.remove();
            });
        });
    }
    
    // Execute replacements button
    const executeBtn = document.getElementById('execute-replacements');
    if (executeBtn) {
        executeBtn.addEventListener('click', executeReplacements);
    }

    // Fix consistency buttons
    const fixProfilesBtn = document.getElementById('fix-profiles');
    if (fixProfilesBtn) fixProfilesBtn.addEventListener('click', fixAllProfiles);

    const fixMaterialsBtn = document.getElementById('fix-materials');
    if (fixMaterialsBtn) fixMaterialsBtn.addEventListener('click', fixAllMaterials);

    // Attach group similar bras/nests button event listener
    const grBtn = document.getElementById('group-bars-btn');
    if (grBtn) grBtn.addEventListener('click', fixSimilarBars);

    // Attach download fnc button event listener
    const dlBtn = document.getElementById('download-fnc-btn');
    if (dlBtn) dlBtn.addEventListener('click', downloadModifiedFNC);
}

// Execute text replacements
function executeReplacements() {
    const replacementItems = document.querySelectorAll('.replacement-item');
    const replacements = [];
    
    replacementItems.forEach(item => {
        const find = item.querySelector('.find-text').value;
        const replace = item.querySelector('.replace-text').value;
        if (find) {
            replacements.push({ find, replace });
        }
    });
    
    if (replacements.length === 0) {
        M.toast({html: 'Please add at least one replacement'});
        return;
    }
    
    // Apply replacements directly on the original file text
    replacements.forEach(r => {
        const regex = new RegExp(r.find, 'g');
        originalFileContent = originalFileContent.replace(regex, r.replace);
    });

    // Re-parse updated original content
    currentData = parseFNC(originalFileContent);

    M.toast({ html: `Applied ${replacements.length} replacement(s)` });
    displayData(currentData, currentFilename);
}

function checkProfileConsistency(data) {
    if (data.profiles.length === 0) return { mismatched: false, count: 0 };
    const refProfile = data.profiles[0];
    let mismatches = 0;

    const checkProfileDiff = (p, fullCheck = false) => {
        if (!p) return false;
        return fullCheck
            ? (
                p.profileType !== refProfile.profileType ||
                p.profile !== refProfile.profile ||
                p.height !== refProfile.height ||
                p.webThickness !== refProfile.webThickness ||
                p.width !== refProfile.width ||
                p.flangeThickness !== refProfile.flangeThickness ||
                p.weightPerMeter !== refProfile.weightPerMeter
            )
            : (
                p.profileType !== refProfile.profileType ||
                p.profile !== refProfile.profile
            );
    };

    // Compare all profiles fully
    data.profiles.forEach((p, i) => {
        if (i > 0 && checkProfileDiff(p, true)) mismatches++;
    });

    // Compare pieces/bars only by type & name
    data.pieces.forEach(p => {
        if (checkProfileDiff(p, false)) mismatches++;
    });
    data.bars.forEach(b => {
        if (checkProfileDiff(b, false)) mismatches++;
    });

    return { mismatched: mismatches > 0, count: mismatches };
}

function checkMaterialConsistency(data) {
    if (data.materials.length === 0) return { mismatched: false, count: 0 };
    const refMaterial = data.materials[0];
    let mismatches = 0;

    // Compare materials
    data.materials.forEach((m, i) => {
        if (i > 0 && m !== refMaterial) mismatches++;
    });

    // Compare pieces
    data.pieces.forEach(p => {
        if (p.material && p.material !== refMaterial) mismatches++;
    });

    // Compare bars
    data.bars.forEach(b => {
        if (b.material && b.material !== refMaterial) mismatches++;
    });

    return { mismatched: mismatches > 0, count: mismatches };
}

// Fix functions
function fixAllProfiles() {
    if (!currentData || currentData.profiles.length === 0) return;
    const ref = currentData.profiles[0];

    const newCP = `CP:${ref.profileType}`;
    const newP = `P:${ref.profile}`;
    const newSA = `SA${ref.height}`;
    const newTA = `TA${ref.webThickness}`;
    const newSB = `SB${ref.width}`;
    const newTB = `TB${ref.flangeThickness}`;
    const newWL = `WL${ref.weightPerMeter}`;

    // Replace any profile data with first profile data in the file
    originalFileContent = originalFileContent
        .replace(/P:[^\s]+/g, newP)
        .replace(/CP:[^\s]+/g, newCP)
        .replace(/SA[^\s]+/g, newSA)
        .replace(/TA[^\s]+/g, newTA)
        .replace(/SB[^\s]+/g, newSB)
        .replace(/TB[^\s]+/g, newTB)
        .replace(/WL[^\s]+/g, newWL);

    // Re-parse updated file
    currentData = parseFNC(originalFileContent);

    M.toast({ html: 'All profiles fixed' });
    displayData(currentData, currentFilename);
    updateOptionsPanel();
}

function fixAllMaterials() {
    if (!currentData || currentData.materials.length === 0) return;
    const ref = currentData.materials[0];

    const newM = `M:${ref}`;

    // Replace any M:... instance in the file
    originalFileContent = originalFileContent.replace(/M:[^\s]+/g, newM);

    // Re-parse updated file
    currentData = parseFNC(originalFileContent);

    M.toast({ html: 'All materials fixed' });
    displayData(currentData, currentFilename);
    updateOptionsPanel();
}

// Remove all [[BAR]] sections (from [[BAR]] to the next [[ or end of string)
function removeBarSections(text) {
  return text.replace(/\[\[BAR\]\][\s\S]*?(?=\[\[|$)/g, '');
}

function createGroupedBarSection(groupedBars) {
    if (!currentData || currentData.bars.length === 0) return '';

    let barSection = '';

    groupedBars.forEach(group => {
        barSection += '[[BAR]]\n[HEAD]\n';
        barSection += `N:${group.bar.name} M:${group.bar.material} CP:${group.bar.profileType} P:${group.bar.profile}\nLB${group.bar.length} BI${group.totalQuantity} ${group.bar.data}\n`;
        group.bar.pieces.forEach(piece => {
            barSection += `[PCS] C:${piece.project} D:${piece.drawing} N:${piece.mark} ${piece.position ? `POS:${piece.position}` : ''} QT${piece.quantity}\n`;
        });
        barSection += '\n'
    });

    return barSection;
}

function setBarsUniqueFlag() {
    const seenHashes = new Set();
    currentData.bars.forEach(bar => {
        if (seenHashes.has(bar.hash)) {
            bar.unique = false;
            duplicateBars = true;
        }
        else {
            bar.unique = true;
            seenHashes.add(bar.hash);
        }
    });
}

function fixSimilarBars() {
    const groupedBars = groupSimilarBars();
    if (groupedBars.length === 0) return;

    // Remove all existing [[BAR]] sections
    let modifiedContent = removeBarSections(originalFileContent);
    modifiedContent += '\n' + createGroupedBarSection(groupedBars);

    originalFileContent = modifiedContent;

    // Re-parse updated file
    currentData = parseFNC(originalFileContent);

    duplicateBars = false; // Reset global variable
    M.toast({ html: 'All bars grouped' });
    displayData(currentData, currentFilename);
    updateOptionsPanel();
}