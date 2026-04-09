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
    spe: { atk: "Timid", def: "Hasty", spa: "Jolly", spd: "Naïve" }
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

const btn = document.querySelector('#calcBtn') as HTMLButtonElement | null;
const resetBtn = document.querySelector('#resetBtn') as HTMLButtonElement | null;
const resultDiv = document.querySelector('#result') as HTMLDivElement | null;
const buildList = document.querySelector('#build-list') as HTMLUListElement | null;
const spBar = document.querySelector('#sp-bar') as HTMLDivElement | null;
const usedSpText = document.querySelector('#used-sp') as HTMLElement | null;
const megaToggle = document.querySelector('#megaToggle') as HTMLInputElement | null;
const pokeDatalist = document.querySelector('#pokeList') as HTMLDataListElement | null;

if (pokeDatalist) {
    const allPokemon = gen9.species.all().filter(s => s.exists && !s.isNonstandard);
    pokeDatalist.innerHTML = allPokemon
        .map(p => `<option value="${p.name}"></option>`)
        .join('');
}

if (btn && resultDiv && buildList && spBar && usedSpText) {
    
    btn.addEventListener('click', () => {
        const nameInput = document.querySelector('#pokeName') as HTMLInputElement | null;
        const statInput = document.querySelector('#statKey') as HTMLInputElement | null;
        const targetInput = document.querySelector('#targetVal') as HTMLInputElement | null;
        const alignmentSelect = document.querySelector('#alignment') as HTMLSelectElement | null;

        if (!nameInput || !statInput || !targetInput || !alignmentSelect) return;

        let name = nameInput.value.trim();
        const stat = statInput.value.toLowerCase().trim();
        const alignment = parseFloat(alignmentSelect.value);
        let target = parseInt(targetInput.value);

        resultDiv.innerHTML = "";

        if (!name) return;

        let species = gen9.species.get(name);
        
        if (megaToggle?.checked) {
            const megaName = `${species.name}-Mega`;
            const megaSpecies = gen9.species.get(megaName);
            if (!megaSpecies.exists) {
                resultDiv.innerHTML = `<div class="error-card"><strong>No Mega Found:</strong> ${species.name} does not have a Mega Evolution.</div>`;
                return;
            }
            species = megaSpecies;
        }

        const baseStatValue = (species.baseStats as any)[stat];
        if (!species.exists || typeof baseStatValue !== 'number') return;

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

        if (isNaN(target) || target < defaultStat) {
            target = defaultStat;
            targetInput.value = target.toString();
            resultDiv.innerHTML = `
                <div style="color: #ff8800; font-size: 0.8em; margin-bottom: 8px; font-style: italic;">
                    ℹ️ Finding baseline... (Max: ${maxPossible} with ${currentLimit} SP remaining)
                </div>`;
        }

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
            let efficiencyNote = "";
            
            if (bestSP > 0 && finalStat === defaultStat) {
                efficiencyNote = `<div style="color:#ff3333; font-size:0.75em; font-weight:bold;">❌ Wasted Points: No increase.</div>`;
            } else if (efficientPoints.includes(bestSP)) {
                efficiencyNote = `<div style="color:#ff8800; font-size:0.75em; font-weight:bold;">✨ Optimized</div>`;
            }

            resultDiv.innerHTML += `
                <div class="result-card">
                    <strong>${species.name}</strong> hits <strong>${finalStat} ${stat.toUpperCase()}</strong> @ <strong>${bestSP} SP</strong>
                    ${efficiencyNote}
                    <button id="addBtn" style="margin-top:10px; background:#ff3333; color:white; border:none; padding:10px; border-radius:5px; width:100%; cursor:pointer; font-weight:bold; text-transform:uppercase;">
                        + Add to Build
                    </button>
                </div>`;

            document.querySelector('#addBtn')?.addEventListener('click', () => {
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
            });
        } else {
            resultDiv.innerHTML = `
                <div class="error-card">
                    <strong>Limit Reached!</strong><br>Max possible is ${maxPossible} with ${currentLimit} SP remaining.
                </div>`;
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
            if (item.natureVal === 1.1) natureHTML = `<span style="color: #ff3333; font-weight: bold; margin-left: 4px;">(+)</span>`;
            if (item.natureVal === 0.9) natureHTML = `<span style="color: #ff8800; font-weight: bold; margin-left: 4px;">(-)</span>`;

            const li = document.createElement('li');
            li.className = "build-item";
            li.innerHTML = `
                <div style="display: flex; align-items: baseline; gap: 8px;">
                    <span style="font-weight: bold;">${item.stat}${natureHTML}</span>
                    <span style="font-size: 0.75em; color: #888;">(${item.baseValue} + <span style="color: #ff3333;">${item.addedValue}</span>)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #ff8800;">${item.amount} SP</span>
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
    });
}