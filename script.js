
/* ---------- 1. ELEMENT CONFIG ---------- */

const GRID = 20; // px grid every element/wire snaps to
const SNAP = (v) => Math.round(v / GRID) * GRID;

// terminal offsets are defined for rotation = 0 (pointing right/left)
const ELEMENT_TYPES = {
    switch:     { icon: "switch.svg",    terminals: [[-30, 0], [30, 0]], fields: [{ key: "state", label: "State", type: "select", options: ["open", "closed"] }] },
    resistor:   { icon: "resistor.svg",  terminals: [[-30, 0], [30, 0]], fields: [{ key: "resistance", label: "Resistance", unit: "Ω", type: "number" }] },
    capacitor:  { icon: "capacitor.svg", terminals: [[-30, 0], [30, 0]], fields: [{ key: "capacitance", label: "Capacitance", unit: "F", type: "number" }] },
    inductor:   { icon: "inductor.svg",  terminals: [[-30, 0], [30, 0]], fields: [{ key: "inductance", label: "Inductance", unit: "H", type: "number" }] },
    diode:      { icon: "diode.svg",     terminals: [[-30, 0], [30, 0]], fields: [] },
    voltage:    { icon: "voltage.svg",   terminals: [[-30, 0], [30, 0]], fields: [{ key: "voltage", label: "Voltage", unit: "V", type: "number" }] },
    current:    { icon: "current.svg",   terminals: [[-30, 0], [30, 0]], fields: [{ key: "current", label: "Current", unit: "A", type: "number" }] },
    ground:     { icon: "ground.svg",    terminals: [[0, -20]],          fields: [] },
};

const DEFAULT_PROPS = {
    switch: { state: "closed" },
    resistor: { resistance: 1000 },
    capacitor: { capacitance: 0.000001 },
    inductor: { inductance: 0.001 },
    diode: {},
    voltage: { voltage: 5 },
    current: { current: 0.01 },
    ground: {},
};

/* ---------- LEARN CONTENT ---------- */

const LEARN_CONTENT = {
    wire: {
        title: "Wire",
        blurb: "A wire is a perfect conductor — it just carries current from one point to another with zero resistance.",
        formula: "No formula — a wire has 0 Ω resistance.",
        analogy: "Think of it like a hallway with no obstacles: whatever walks in one end walks straight out the other.",
    },
    switch: {
        title: "Switch",
        blurb: "A switch either connects (closed) or breaks (open) a path in the circuit. It's the simplest way to control whether current can flow.",
        formula: "Closed = 0 Ω (acts like a wire). Open = ∞ Ω (acts like a break).",
        analogy: "Like a light switch on a wall — flip it and you either complete or interrupt the path for electricity.",
    },
    resistor: {
        title: "Resistor",
        blurb: "A resistor limits how much current can flow through it. The bigger the resistance, the harder it is for current to pass.",
        formula: "Ohm's Law: V = I × R (Voltage = Current × Resistance)",
        analogy: "Like a narrow pipe restricting water flow — more resistance (a narrower pipe) means less current (less water) for the same push (voltage/pressure).",
    },
    capacitor: {
        title: "Capacitor",
        blurb: "A capacitor stores electrical energy temporarily, like a tiny rechargeable battery. It charges up and can release that energy quickly later.",
        formula: "Q = C × V (Charge = Capacitance × Voltage)",
        analogy: "Like a small water tank on a pipe — it fills up (charges) and can release a burst of water (current) later.",
    },
    inductor: {
        title: "Inductor",
        blurb: "An inductor resists sudden changes in current by storing energy in a magnetic field. It smooths out current spikes.",
        formula: "V = L × (dI/dt) — voltage depends on how fast current is changing",
        analogy: "Like a heavy flywheel on a pipe — hard to speed up or slow down suddenly, but once flowing, it keeps flowing.",
    },
    diode: {
        title: "Diode",
        blurb: "A diode only lets current flow in one direction. It blocks current trying to flow the opposite way.",
        formula: "Conducts when forward-biased (~0.7V drop for silicon); blocks when reverse-biased.",
        analogy: "Like a one-way valve in a pipe — water (current) can only flow one direction through it.",
    },
    voltage: {
        title: "Voltage source",
        blurb: "A voltage source pushes current through a circuit by maintaining a fixed voltage difference between its two terminals, no matter what's connected.",
        formula: "V is fixed by the source; I depends on the rest of the circuit (Ohm's Law).",
        analogy: "Like a water pump that always pushes at the same pressure, regardless of how much pipe is connected.",
    },
    current: {
        title: "Current source",
        blurb: "A current source pushes a fixed amount of current through the circuit, adjusting its own voltage to whatever is needed to maintain that current.",
        formula: "I is fixed by the source; V adjusts based on the rest of the circuit.",
        analogy: "Like a pump that always pushes exactly the same amount of water per second, no matter how much resistance it meets.",
    },
    ground: {
        title: "Ground",
        blurb: "Ground is the reference point for all voltages in the circuit — it's defined as 0V. Every other voltage is measured relative to it.",
        formula: "V(ground) = 0V, always.",
        analogy: "Like sea level for measuring elevation — you need a fixed reference point before 'height' (voltage) means anything.",
    },
};

/* ---------- 2. STATE ---------- */

let elements = [];  
let wires = [];       
let nextId = 1;

let selectedEl = null;      
let draggingEl = null;      
let dragOffset = { x: 0, y: 0 };

let wireMode = false;       
let wireStart = null;       

const canvas = document.querySelector("main section");
const wireLayer = document.getElementById("wireLayer");
const propsPanel = document.querySelector(".right-box-card");

/* ---------- 3. RENDERING ---------- */

function rotatePoint([dx, dy], deg) {
    const rad = (deg * Math.PI) / 180;
    return [dx * Math.cos(rad) - dy * Math.sin(rad), dx * Math.sin(rad) + dy * Math.cos(rad)];
}

function terminalPositions(el) {
    const cfg = ELEMENT_TYPES[el.type];
    return cfg.terminals.map(([dx, dy]) => {
        const [rx, ry] = rotatePoint([dx, dy], el.rotation);
        return { x: el.x + rx, y: el.y + ry };
    });
}

function render() {
    // clear canvas of previously placed elements + terminal dots (keep the SVG wire layer itself)
    canvas.querySelectorAll(".placed-element").forEach((n) => n.remove());
    canvas.querySelectorAll(".terminal").forEach((n) => n.remove());
    wireLayer.innerHTML = "";

    // draw wires
    wires.forEach((w) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", w.x1);
        line.setAttribute("y1", w.y1);
        line.setAttribute("x2", w.x2);
        line.setAttribute("y2", w.y2);
        line.setAttribute("class", "wire-line");
        wireLayer.appendChild(line);
    });

    // draw elements
    elements.forEach((el) => {
        const cfg = ELEMENT_TYPES[el.type];
        const div = document.createElement("div");
        div.className = "placed-element" + (el === selectedEl ? " selected" : "");
        div.style.left = el.x - 30 + "px";
        div.style.top = el.y - 20 + "px";
        div.dataset.id = el.id;

        const img = document.createElement("img");
        img.src = cfg.icon;
        img.style.transform = `rotate(${el.rotation}deg)`;
        div.appendChild(img);

        div.addEventListener("mousedown", (e) => onElementMouseDown(e, el));
        canvas.appendChild(div);

        // terminal dots (in canvas coordinates, so append to canvas, not div)
        terminalPositions(el).forEach((t) => {
            const dot = document.createElement("div");
            dot.className = "terminal";
            dot.style.left = t.x - 4 + "px";
            dot.style.top = t.y - 4 + "px";
            dot.addEventListener("click", (e) => {
                e.stopPropagation();
                handleTerminalClick(t);
            });
            canvas.appendChild(dot);
        });
    });

    renderPropsPanel();
}

/* ---------- LEARN MODAL ---------- */

function openLearnModal(type) {
    const content = LEARN_CONTENT[type];
    if (!content) return;

    const overlay = document.createElement("div");
    overlay.className = "learn-overlay";
    overlay.innerHTML = `
        <div class="learn-modal">
            <button class="learn-close" aria-label="Close">&times;</button>
            <h2>${content.title}</h2>
            <p class="learn-blurb">${content.blurb}</p>
            <div class="learn-block">
                <span class="learn-label">Formula</span>
                <p>${content.formula}</p>
            </div>
            <div class="learn-block">
                <span class="learn-label">Think of it like...</span>
                <p>${content.analogy}</p>
            </div>
        </div>
    `;

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector(".learn-close").addEventListener("click", () => overlay.remove());

    document.addEventListener("keydown", function escClose(e) {
        if (e.key === "Escape") {
            overlay.remove();
            document.removeEventListener("keydown", escClose);
        }
    });

    document.body.appendChild(overlay);
}

// info icon on each palette button
document.querySelectorAll(".circuit_elements button[data-type]").forEach((btn) => {
    const type = btn.dataset.type;
    if (!LEARN_CONTENT[type]) return;

    const info = document.createElement("span");
    info.className = "info-icon";
    info.textContent = "?";
    info.title = `Learn about ${LEARN_CONTENT[type].title}`;
    info.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openLearnModal(type);
    });
    // prevent the info icon from starting a drag
    info.addEventListener("mousedown", (e) => e.stopPropagation());
    info.addEventListener("dragstart", (e) => e.preventDefault());

    btn.style.position = "relative";
    btn.appendChild(info);
});

/* ---------- 4. DRAG & DROP FROM PALETTE ---------- */

document.querySelectorAll(".circuit_elements button[data-type]").forEach((btn) => {
    btn.setAttribute("draggable", "true");
    btn.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", btn.dataset.type);
    });
});

canvas.addEventListener("dragover", (e) => e.preventDefault());

canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/plain");
    if (!ELEMENT_TYPES[type]) return;

    const rect = canvas.getBoundingClientRect();
    const x = SNAP(e.clientX - rect.left);
    const y = SNAP(e.clientY - rect.top);

    const el = {
        id: nextId++,
        type,
        x,
        y,
        rotation: 0,
        props: { ...DEFAULT_PROPS[type] },
        result: null,
    };
    elements.push(el);
    selectElement(el);
});

/* ---------- 5. SELECT / MOVE / ROTATE / DELETE / CANCEL ---------- */

function selectElement(el) {
    selectedEl = el;
    render();
}

function onElementMouseDown(e, el) {
    if (wireMode) return; // wire tool has its own click handling on terminals
    e.stopPropagation();
    selectElement(el);
    draggingEl = el;
    const rect = canvas.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left - el.x, y: e.clientY - rect.top - el.y };
}

canvas.addEventListener("mousemove", (e) => {
    if (!draggingEl) return;
    const rect = canvas.getBoundingClientRect();
    draggingEl.x = SNAP(e.clientX - rect.left - dragOffset.x);
    draggingEl.y = SNAP(e.clientY - rect.top - dragOffset.y);
    render();
});

document.addEventListener("mouseup", () => {
    draggingEl = null;
});

canvas.addEventListener("click", (e) => {
    if (e.target === canvas) {
        if (wireMode) return; 
        selectedEl = null;
        render();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r" && selectedEl) {
        selectedEl.rotation = (selectedEl.rotation + 90) % 360;
        render();
    }
    if (e.key === "Delete" && selectedEl) {
        elements = elements.filter((el) => el !== selectedEl);
        selectedEl = null;
        render();
    }
    if (e.key === "Escape") {
        wireMode = false;
        wireStart = null;
        selectedEl = null;
        canvas.classList.remove("wire-mode");
        render();
    }
});

/* ---------- 6. WIRE TOOL ---------- */

const wireBtn = document.querySelector('.circuit_elements button[data-type="wire"]');
if (wireBtn) {
    wireBtn.addEventListener("click", () => {
        wireMode = true;
        wireStart = null;
        selectedEl = null;
        canvas.classList.add("wire-mode");
        render();
    });
}

canvas.addEventListener("click", (e) => {
    if (!wireMode || e.target !== canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = SNAP(e.clientX - rect.left);
    const y = SNAP(e.clientY - rect.top);
    handleWireClick({ x, y });
});

function handleTerminalClick(point) {
    if (!wireMode) return;
    handleWireClick(point);
}

function handleWireClick(point) {
    if (!wireStart) {
        wireStart = point;
        return;
    }
    wires.push({ id: nextId++, x1: wireStart.x, y1: wireStart.y, x2: point.x, y2: point.y });
    wireStart = null;
    wireMode = false;
    canvas.classList.remove("wire-mode");
    render();
}

/* ---------- 7. PROPERTIES PANEL ---------- */

function renderPropsPanel() {
    const dynamic = document.getElementById("propsDynamic");
    if (!dynamic) return;
    dynamic.innerHTML = "";

    if (!selectedEl) {
        dynamic.innerHTML = '<p class="props-hint">Select an element to edit its properties.</p>';
        return;
    }

    const cfg = ELEMENT_TYPES[selectedEl.type];
    const title = document.createElement("h2");
    title.textContent = selectedEl.type[0].toUpperCase() + selectedEl.type.slice(1);
    dynamic.appendChild(title);

    if (LEARN_CONTENT[selectedEl.type]) {
        const learnBtn = document.createElement("button");
        learnBtn.textContent = "Learn about this";
        learnBtn.className = "learn-btn";
        learnBtn.addEventListener("click", () => openLearnModal(selectedEl.type));
        dynamic.appendChild(learnBtn);
    }

    cfg.fields.forEach((f) => {
        const row = document.createElement("div");
        row.className = "prop-row";

        const label = document.createElement("label");
        label.textContent = f.label + (f.unit ? ` (${f.unit})` : "");
        row.appendChild(label);

        let input;
        if (f.type === "select") {
            input = document.createElement("select");
            f.options.forEach((opt) => {
                const o = document.createElement("option");
                o.value = opt;
                o.textContent = opt;
                if (selectedEl.props[f.key] === opt) o.selected = true;
                input.appendChild(o);
            });
        } else {
            input = document.createElement("input");
            input.type = "number";
            input.step = "any";
            input.value = selectedEl.props[f.key];
        }

        input.addEventListener("input", () => {
            const v = f.type === "select" ? input.value : parseFloat(input.value);
            selectedEl.props[f.key] = v;
        });

        row.appendChild(input);
        dynamic.appendChild(row);
    });

    if (selectedEl.result) {
        const res = document.createElement("div");
        res.className = "prop-result";
        res.innerHTML = `<strong>Simulation</strong><br>
            V = ${selectedEl.result.voltage.toFixed(3)} V<br>
            I = ${selectedEl.result.current.toFixed(6)} A`;
        dynamic.appendChild(res);
    }

    const del = document.createElement("button");
    del.textContent = "Delete element";
    del.className = "prop-delete-btn";
    del.addEventListener("click", () => {
        elements = elements.filter((el) => el !== selectedEl);
        selectedEl = null;
        render();
    });
    dynamic.appendChild(del);
}

/* ---------- 8. CIRCUIT SOLVER (Modified Nodal Analysis, DC steady state) ---------- */
/*
   Assumptions / simplifications (documented so it's easy to extend later):
   - Steady-state DC only: capacitors -> open circuit, inductors -> short circuit.
   - Diodes are not solved as nonlinear devices yet (excluded from the matrix).
   - Open switches are excluded from the matrix; closed switches act like wires.
   - Node connectivity is determined purely by matching wire/terminal coordinates
     (everything must snap to the same grid point to be "connected").
*/

function union(parent, a, b) {
    const ra = find(parent, a), rb = find(parent, b);
    if (ra !== rb) parent[ra] = rb;
}
function find(parent, a) {
    if (!(a in parent)) parent[a] = a;
    if (parent[a] !== a) parent[a] = find(parent, parent[a]);
    return parent[a];
}
const key = (p) => `${p.x},${p.y}`;

function simulate() {
    const parent = {};

    // union everything connected by a drawn wire
    wires.forEach((w) => union(parent, key({ x: w.x1, y: w.y1 }), key({ x: w.x2, y: w.y2 })));

    // union terminals of "short-like" elements: closed switches, inductors (DC short)
    elements.forEach((el) => {
        const t = terminalPositions(el);
        if ((el.type === "switch" && el.props.state === "closed") || el.type === "inductor") {
            union(parent, key(t[0]), key(t[1]));
        }
    });

    // find ground root
    const groundEl = elements.find((el) => el.type === "ground");
    if (!groundEl) {
        alert("Add a Ground element before simulating — there's no 0V reference node.");
        return;
    }
    const groundRoot = find(parent, key(terminalPositions(groundEl)[0]));

    // assign node indices, forcing groundRoot -> 0
    const rootToNode = { [groundRoot]: 0 };
    let nodeCount = 1;
    const nodeOf = (point) => {
        const root = find(parent, key(point));
        if (!(root in rootToNode)) rootToNode[root] = nodeCount++;
        return rootToNode[root];
    };

    // gather active (matrix-relevant) elements
    const resistors = [];
    const vSources = [];
    const iSources = [];

    elements.forEach((el) => {
        const t = terminalPositions(el);
        if (el.type === "resistor") resistors.push({ a: nodeOf(t[0]), b: nodeOf(t[1]), r: el.props.resistance, el });
        if (el.type === "voltage") vSources.push({ a: nodeOf(t[0]), b: nodeOf(t[1]), v: el.props.voltage, el });
        if (el.type === "current") iSources.push({ a: nodeOf(t[0]), b: nodeOf(t[1]), i: el.props.current, el });
        if (el.type === "switch" && el.props.state === "open") { /* excluded on purpose: open circuit */ }
        if (el.type === "capacitor") { /* excluded: open circuit at DC */ }
    });

    const N = nodeCount - 1;       // unknown node voltages (node 0 = ground = 0V)
    const M = vSources.length;     // unknown voltage-source branch currents
    const size = N + M;
    if (size === 0) {
        alert("Nothing to solve — place some components and wire them to ground.");
        return;
    }

    const A = Array.from({ length: size }, () => new Array(size).fill(0));
    const b = new Array(size).fill(0);
    const u = (n) => n - 1; // node -> unknown index (node must be != 0)

    resistors.forEach(({ a, b: bn, r }) => {
        const g = 1 / r;
        if (a !== 0) A[u(a)][u(a)] += g;
        if (bn !== 0) A[u(bn)][u(bn)] += g;
        if (a !== 0 && bn !== 0) {
            A[u(a)][u(bn)] -= g;
            A[u(bn)][u(a)] -= g;
        }
    });

    iSources.forEach(({ a, b: bn, i }) => {
        if (a !== 0) b[u(a)] -= i;
        if (bn !== 0) b[u(bn)] += i;
    });

    vSources.forEach(({ a, b: bn, v }, k) => {
        const row = N + k;
        if (a !== 0) { A[u(a)][row] += 1; A[row][u(a)] += 1; }
        if (bn !== 0) { A[u(bn)][row] -= 1; A[row][u(bn)] -= 1; }
        b[row] += v;
    });

    const x = solveLinear(A, b);
    if (!x) {
        alert("Couldn't solve this circuit (matrix is singular) — check your wiring for shorts/open loops.");
        return;
    }

    const voltageAt = (node) => (node === 0 ? 0 : x[u(node)]);

    resistors.forEach(({ a, b: bn, r, el }) => {
        const v = voltageAt(a) - voltageAt(bn);
        el.result = { voltage: v, current: v / r };
    });
    iSources.forEach(({ a, b: bn, i, el }) => {
        el.result = { voltage: voltageAt(a) - voltageAt(bn), current: i };
    });
    vSources.forEach(({ el }, k) => {
        el.result = { voltage: el.props.voltage, current: x[N + k] };
    });

    render();
}

// simple Gaussian elimination with partial pivoting
function solveLinear(A, b) {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
        if (Math.abs(M[pivot][col]) < 1e-12) return null;
        [M[col], M[pivot]] = [M[pivot], M[col]];

        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const factor = M[r][col] / M[col][col];
            for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
        }
    }
    return M.map((row, i) => row[n] / row[i]);
}

/* ---------- init ---------- */
const simulateBtn = document.getElementById("simulateBtn");
if (simulateBtn) simulateBtn.addEventListener("click", simulate);

render();