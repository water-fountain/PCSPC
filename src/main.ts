import { Dex } from '@pkmn/dex';

const gen9 = Dex.forGen(9);
const REG_MA_CAP = 32;
const TOTAL_BUDGET = 66;

let currentUsedSP = 0;
let buildStats: { 
    stat: string; 
    amount: number; 
    baseValue: number; 
    addedValue: number;
    natureVal: number; 
}[] = [];

const NATURE_MAP: Record<string, Record<string, string>> = {
    atk: { def: "Lonely", spa: "Adamant", spd: "Naughty", spe: "Brave" },
    def: { atk: "Bold", spa: "Impish", spd: "Lax", spe: "Relaxed" },
    spa: { atk: "Modest", def: "Mild", spd: "Rash", spe: "Quiet" },
    spd: { atk: "Calm", def: "Gentle", spa: "Careful", spe: "Sassy" },
    spe: { atk: "Timid", Hasty: "Hasty", Jolly: "Jolly", Naive: "Naïve" }
};

function getNatureName(stats: typeof buildStats): string {
    const plus = stats.find(s => s.natureVal === 1.1)?.stat.toLowerCase();
    const minus = stats.find(s => s.natureVal === 0.9)?.stat.toLowerCase();
    if (plus && minus) return NATURE_MAP[plus]?.[minus] || "Unknown";
    if (plus || minus) return "Pending selection of opposite alignment...";
    if (stats.length > 0) return "Neutral (Hardy/Docile/etc.)";
    return "Start building to detect Nature";
}

function calculateChampionStat(base: number, sp: number = 0, nature: number = 1.0): number {
    return Math.floor((base + 20 + sp) * nature);
}

// UI Selectors
const btn = document.querySelector('#calcBtn') as HTMLButtonElement | null;
const resetBtn = document.querySelector('#resetBtn') as HTMLButtonElement | null;
const resultDiv = document.querySelector('#result') as HTMLDivElement | null;
const buildList = document.querySelector('#build-list') as HTMLUListElement | null;
const spBar = document.querySelector('#sp-bar') as HTMLDivElement | null;
const usedSpText = document.querySelector('#used-sp') as HTMLElement | null;
const nameInput = document.querySelector('#pokeName') as HTMLInputElement | null;
const megaToggle = document.querySelector('#megaToggle') as HTMLInputElement | null;
const megaXToggle = document.querySelector('#megaX') as HTMLInputElement | null;
const megaYToggle = document.querySelector('#megaY') as HTMLInputElement | null;
const megaSubOptions = document.querySelector('.mega-sub-options') as HTMLDivElement | null;
const pokeDatalist = document.querySelector('#pokeList') as HTMLDataListElement | null;
const targetWarning = document.querySelector('#targetWarning') as HTMLDivElement | null;

// --- 1. Datalist Initialization ---
if (pokeDatalist) {
    const allPokemon = gen9.species.all().filter(s => s.exists && !s.isNonstandard);
    pokeDatalist.innerHTML = allPokemon
        .map(p => `<option value="${p.name}"></option>`)
        .join('');
}

// --- 2. Conditional Mega UI & Mutual Exclusion ---
function updateMegaVisibility() {
    if (!nameInput || !megaSubOptions) return;
    const species = gen9.species.get(nameInput.value);
    
    // Check if X and Y exist for this specific species
    const hasX = gen9.species.get(`${species.name}-Mega-X`).exists;
    const hasY = gen9.species.get(`${species.name}-Mega-Y`).exists;

    if (hasX && hasY) {
        megaSubOptions.classList.add('visible');
    } else {
        megaSubOptions.classList.remove('visible');
        if (megaXToggle) megaXToggle.checked = false;
        if (megaYToggle) megaYToggle.checked = false;
    }
}

nameInput?.addEventListener('input', updateMegaVisibility);

// MUTUAL EXCLUSION LOGIC
megaXToggle?.addEventListener('change', () => {
    if (megaXToggle.checked && megaYToggle) megaYToggle.checked = false;
});

megaYToggle?.addEventListener('change', () => {
    if (megaYToggle.checked && megaXToggle) megaXToggle.checked = false;
});

// --- 3. Main Calculation Logic ---
if (btn && resultDiv && buildList && spBar && usedSpText) {
    
    btn.addEventListener('click', () => {
        const statInput = document.querySelector('#statKey') as HTMLInputElement | null;
        const targetInput = document.querySelector('#targetVal') as HTMLInputElement | null;
        const alignmentSelect = document.querySelector('#alignment') as HTMLSelectElement | null;

        if (!nameInput || !statInput || !targetInput || !alignmentSelect) return;

        let name = nameInput.value.trim();
        const stat = statInput.value.toLowerCase().trim();
        const alignment = parseFloat(alignmentSelect.value);
        let rawInput = parseInt(targetInput.value);
        let target = rawInput;

        resultDiv.innerHTML = "";
        if (targetWarning) targetWarning.style.display = "none";

        if (!name) return;

        let species = gen9.species.get(name);
        
        // --- UPDATED MULTI-MEGA PROTOCOL ---
        if (megaToggle?.checked) {
            const baseName = species.name;
            let targetMegaName = `${baseName}-Mega`;

            // If X/Y is visible, check if they are toggled
            if (megaSubOptions?.classList.contains('visible')) {
                if (megaXToggle?.checked) {
                    targetMegaName = `${baseName}-Mega-X`;
                } else if (megaYToggle?.checked) {
                    targetMegaName = `${baseName}-Mega-Y`;
                }
            }

            let megaSpecies = gen9.species.get(targetMegaName);

            // FALLBACK: If specific X/Y check fails or isn't toggled, use standard Mega
            if (!megaSpecies.exists) {
                megaSpecies = gen9.species.get(`${baseName}-Mega`);
            }
            
            if (!megaSpecies.exists) {
                resultDiv.innerHTML = `<div class="error-card">⚠️ ${baseName} does not have a Mega Evolution.</div>`;
                return;
            }
            species = megaSpecies;
        }

        const baseStatValue = (species.baseStats as any)[stat];
        if (!species.exists || typeof baseStatValue !== 'number') return;

        // Constraint Checks
        const hasPositive = buildStats.some(s => s.natureVal === 1.1);
        const hasNegative = buildStats.some(s => s.natureVal === 0.9);

        if (alignment === 1.1 && hasPositive) {
            resultDiv.innerHTML = `<div class="error-card">Invalid: Build already has a Positive (+) stat.</div>`;
            return;
        }
        if (alignment === 0.9 && hasNegative) {
            resultDiv.innerHTML = `<div class="error-card">Invalid: Build already has a Negative (-) stat.</div>`;
            return;
        }
        if (buildStats.some(item => item.stat === stat.toUpperCase())) {
            resultDiv.innerHTML = `<div class="error-card">Stat already in build.</div>`;
            return;
        }

        const remainingWallet = TOTAL_BUDGET - currentUsedSP;
        const currentLimit = Math.min(REG_MA_CAP, remainingWallet);
        
        const defaultStat = calculateChampionStat(baseStatValue, 0, alignment);
        const maxPossible = calculateChampionStat(baseStatValue, currentLimit, alignment);

        // Adjust for Max Threshold
        if (!isNaN(rawInput) && rawInput > maxPossible) {
            target = maxPossible;
            targetInput.value = maxPossible.toString();
            if (targetWarning) {
                targetWarning.textContent = "⚠️ EXCEEDED MAXIMUM THRESHOLD: ADJUSTED TO LIMIT";
                targetWarning.style.display = "block";
            }
        } else if (isNaN(rawInput) || rawInput < defaultStat) {
            target = defaultStat;
            targetInput.value = defaultStat.toString();
        }

        const baselineHTML = `<div style="color: #ffffff; font-size: 0.8em; margin-bottom: 8px; font-style: italic;">
                ℹ️ Finding baseline... (Max: ${maxPossible} ${stat.toUpperCase()} @ ${currentLimit} SP)
            </div>`;

        let bestSP = -1;
        for (let sp = 0; sp <= currentLimit; sp++) {
            if (calculateChampionStat(baseStatValue, sp, alignment) >= target) {
                bestSP = sp;
                break;
            }
        }

        if (bestSP !== -1) {
            const finalStat = calculateChampionStat(baseStatValue, bestSP, alignment);
            const literalAdded = finalStat - defaultStat;
            const efficientPoints = [0, 4, 12, 20, 28, REG_MA_CAP];
            
            let optimizationHTML = "";
            const isJumpPoint = alignment === 1.1 && (baseStatValue + 20 + bestSP) % 10 === 0;
            const isMaxed = bestSP === REG_MA_CAP;

            if (alignment === 1.1) {
                if (isJumpPoint || isMaxed) {
                    optimizationHTML = `<div style="color: #ffffff; font-size: 0.75em; font-weight: bold; margin-top: 4px;">✨ Optimized</div>`;
                } else {
                    const currentTotal = baseStatValue + 20 + bestSP;
                    const remainder = currentTotal % 10;
                    const spDown = Math.max(0, bestSP - remainder);
                    const spUp = bestSP + (10 - remainder);
                    const targetCap = Math.min(REG_MA_CAP, spUp);

                    let advice = `⚠️ Round `;
                    if (spDown !== bestSP) advice += `DOWN to <strong>${spDown} SP</strong>`;
                    if (spDown !== bestSP && targetCap <= currentLimit && targetCap !== bestSP) advice += ` or `;
                    if (targetCap <= currentLimit && targetCap !== bestSP) advice += `UP to <strong>${targetCap} SP</strong>`;
                    advice += ` to maximize optimization.`;
                    optimizationHTML = `<div style="color: #ffcc00; font-size: 0.75em; margin-top: 4px; font-style: italic;">${advice}</div>`;
                }
            } else {
                if (efficientPoints.includes(bestSP)) {
                    optimizationHTML = `<div style="color: #ffffff; font-size: 0.75em; font-weight: bold; margin-top: 4px;">✨ Optimized</div>`;
                } else {
                    const lower = [...efficientPoints].reverse().find(p => p < bestSP) ?? 0;
                    const upper = efficientPoints.find(p => p > bestSP) ?? REG_MA_CAP;
                    const targetCap = Math.min(currentLimit, upper);

                    let advice = `⚠️ Round `;
                    if (lower !== bestSP) advice += `DOWN to <strong>${lower} SP</strong>`;
                    if (lower !== bestSP && targetCap !== bestSP) advice += ` or `;
                    if (targetCap !== bestSP) advice += `UP to <strong>${targetCap} SP</strong>`;
                    advice += ` to maximize optimization.`;
                    optimizationHTML = `<div style="color: #ffcc00; font-size: 0.75em; margin-top: 4px; font-style: italic;">${advice}</div>`;
                }
            }

            if (bestSP > 0 && finalStat === defaultStat) {
                optimizationHTML = `<div style="color:#ff3333; font-size:0.75em; font-weight:bold; margin-top: 4px;">❌ Wasted Points: No increase.</div>`;
            }

            resultDiv.innerHTML = baselineHTML + `
                <div class="result-card">
                    <strong>${species.name}</strong> hits <strong>${finalStat} ${stat.toUpperCase()}</strong> @ <strong>${bestSP} SP</strong>
                    ${optimizationHTML}
                    <button id="addBtn" style="margin-top:10px; background:#ff3333; color:white; border:none; padding:10px; border-radius:5px; width:100%; cursor:pointer; font-weight:bold; text-transform:uppercase;">
                        + Add to Build
                    </button>
                </div>`;

            const addBtn = document.querySelector('#addBtn') as HTMLButtonElement | null;
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    if (currentUsedSP + bestSP > TOTAL_BUDGET) return;
                    currentUsedSP += bestSP;
                    buildStats.push({ 
                        stat: stat.toUpperCase(), 
                        amount: bestSP, 
                        baseValue: defaultStat, 
                        addedValue: literalAdded,
                        natureVal: alignment 
                    });
                    updateBuildUI();
                    resultDiv.innerHTML = ""; 
                    if (targetWarning) targetWarning.style.display = "none";
                });
            }
        }
    });
}

function updateBuildUI() {
    if (usedSpText) usedSpText.textContent = currentUsedSP.toString();
    if (spBar) spBar.style.width = `${(currentUsedSP / TOTAL_BUDGET) * 100}%`;
    
    if (buildList) {
        buildList.innerHTML = "";
        const natureName = getNatureName(buildStats);
        const natureHeader = document.createElement('div');
        natureHeader.className = "nature-header";
        natureHeader.innerHTML = `<span style="color: #888; font-size: 0.8em; text-transform: uppercase;">Detected Nature</span><br><strong>${natureName}</strong>`;
        buildList.appendChild(natureHeader);

        buildStats.forEach((item, index) => {
            let natureHTML = "";
            if (item.natureVal === 1.1) natureHTML = `<span style="color: #08ce29; font-weight: bold; margin-left: 4px;">(+)</span>`;
            if (item.natureVal === 0.9) natureHTML = `<span style="color: #ff0000; font-weight: bold; margin-left: 4px;">(-)</span>`;

            const li = document.createElement('li');
            li.className = "build-item";
            li.innerHTML = `
                <div style="display: flex; align-items: baseline; gap: 8px;">
                    <span style="font-weight: bold;">${item.stat}${natureHTML}</span>
                    <span style="font-size: 0.75em; color: #888;">(${item.baseValue} + <span style="color: #ff3333;">${item.addedValue}</span>)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #9900ff;">${item.amount} SP</span>
                    <button class="remove-btn" data-index="${index}">×</button>
                </div>`;
            buildList.appendChild(li);
        });

        document.querySelectorAll('.remove-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const t = e.target as HTMLButtonElement;
                const idx = parseInt(t.dataset.index!);
                currentUsedSP -= buildStats[idx].amount;
                buildStats.splice(idx, 1);
                updateBuildUI();
            });
        });
    }
}

if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        currentUsedSP = 0;
        buildStats = [];
        updateBuildUI();
        if (resultDiv) resultDiv.innerHTML = "";
        if (targetWarning) targetWarning.style.display = "none";
    });
}