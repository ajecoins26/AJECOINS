import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, setDoc, doc, deleteDoc, 
    query, where, writeBatch, serverTimestamp, orderBy, limit 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmfn78n85qiOzmu-u9nwsPiOlXXFDYwcU",
    authDomain: "ajecoins26-3d123.firebaseapp.com",
    projectId: "ajecoins26-3d123",
    storageBucket: "ajecoins26-3d123.firebasestorage.app",
    messagingSenderId: "377488479071",
    appId: "1:377488479071:web:3ea4c4c9a6b2380e375cea"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* --- UTILIDADES --- */
const showLoader = (t) => { 
    document.getElementById("loaderText").innerText = t; 
    document.getElementById("loader").classList.add("active"); 
};
const hideLoader = () => document.getElementById("loader").classList.remove("active");

function limpiarTexto(t) {
    if(!t) return "";
    return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

const SEDES = ["AMBATO","BABAHOYO","CARCHI","CHONE","CUENCA","DURAN","ECONORED C","ECONORED O","ECONORED S","ESMERALDAS","GUARANDA","GUAYAQUIL NORTE","GUAYAQUIL SUR","IBARRA","LAGO AGRIO","LOJA CENTRAL","MACAS","MACHACHI","MACHALA","MANTA","MAYORISTA G","MILAGRO","PEDRO CARBO","PENINSULA","PUYO","QUEVEDO","QUININDE","QUITO NORTE","QUITO SUR","RIOBAMBA","SACHA","SAMBORONDON","SANTO DOMINGO","TENA","VENTANAS"];

window.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('filtroCedisMaestra');
    if(select) {
        SEDES.sort().forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            select.appendChild(opt);
        });
    }
});

function exportarTablaACsv(idTabla, nombreArchivo) {
    const tabla = document.getElementById(idTabla);
    let filas = Array.from(tabla.querySelectorAll("tr"));
    if (filas.length <= 1) return alert("No hay datos para exportar");
    let contenidoCsv = filas.map(f => {
        let celdas = Array.from(f.querySelectorAll("th, td"));
        if(idTabla === "maestraTable") celdas = celdas.slice(0, -1);
        return celdas.map(c => `"${c.innerText.replace(/"/g, '""')}"`).join(";");
    }).join("\n");
    const blob = new Blob(["\ufeff" + contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nombreArchivo + "_" + new Date().getTime() + ".csv";
    link.click();
}

document.querySelectorAll('.accordion-header').forEach(btn => {
    btn.onclick = () => {
        const content = btn.nextElementSibling;
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
    };
});

window.eliminarUsuarioTotal = async (cod) => {
    if(!confirm(`⚠️ ¿Eliminar historial y acceso de ${cod}?`)) return;
    showLoader("Borrando...");
    try {
        const batch = writeBatch(db);
        const q1 = query(collection(db, "usuariosPorFecha"), where("codVendedor", "==", cod));
        const s1 = await getDocs(q1);
        s1.forEach(d => batch.delete(d.ref));
        const q2 = query(collection(db, "compras"), where("codVendedor", "==", cod));
        const s2 = await getDocs(q2);
        s2.forEach(d => batch.delete(d.ref));
        await batch.commit();
        alert("Eliminado con éxito.");
        document.getElementById("btnCargarMaestra").click();
    } catch (e) { alert("Error al eliminar."); }
    hideLoader();
};

/* --- CARGAS --- */
document.getElementById("uploadBtn").onclick = async () => {
    const file = document.getElementById("fileInput").files[0];
    if(!file) return alert("Selecciona CSV");
    showLoader("Procesando usuarios...");
    const text = await file.text();
    const lines = text.trim().split("\n").slice(1);
    let batch = writeBatch(db);
    let count = 0, total = 0;
    try {
        for (const line of lines) {
            let [f, cod, nom, ceds, cns] = line.split(";").map(x => x?.trim());
            if(!f || !cod) continue;
            const cleanedCedis = limpiarTexto(ceds);
            const docId = `${f.replace(/\//g,'-')}_${cod}_${cleanedCedis.replace(/\s+/g,'')}`;
            batch.set(doc(db, "usuariosPorFecha", docId), {
                fecha: f, codVendedor: cod, nombre: limpiarTexto(nom), 
                cedis: cleanedCedis, coins_ganados: Number(cns) || 0,
                actualizado: serverTimestamp()
            }, { merge: true });
            count++; total++;
            if (count === 450) { 
                await batch.commit(); batch = writeBatch(db); count = 0;
                showLoader(`Subiendo: ${total}`);
            }
        }
        if (count > 0) await batch.commit();
        alert("Carga de usuarios exitosa");
    } catch (e) { alert("Error en carga"); }
    hideLoader();
};

/* --- CONSULTAS --- */
document.getElementById("btnCargarMaestra").onclick = async () => {
    const cedi = document.getElementById("filtroCedisMaestra").value;
    const codBusqueda = document.getElementById("inputBusquedaVendedor").value.trim();
    showLoader("Consultando base de datos...");
    const tbody = document.querySelector("#maestraTable tbody");
    tbody.innerHTML = "";
    try {
        let q = collection(db, "usuariosPorFecha");
        if(cedi) q = query(q, where("cedis", "==", cedi));
        if(codBusqueda) q = query(q, where("codVendedor", "==", codBusqueda));
        if(!cedi && !codBusqueda) q = query(q, limit(400));

        const snap = await getDocs(q);
        const fragment = document.createDocumentFragment();
        let unicos = new Set();
        snap.forEach(d => {
            const r = d.data();
            const key = `${r.codVendedor}_${r.cedis}`;
            if (!unicos.has(key)) {
                unicos.add(key);
                const tr = document.createElement("tr");
                tr.innerHTML = `<td>${r.codVendedor}</td><td>${r.nombre}</td><td>${r.cedis}</td>
                                <td><button class="btn-eliminar" onclick="eliminarUsuarioTotal('${r.codVendedor}')">Eliminar</button></td>`;
                fragment.appendChild(tr);
            }
        });
        tbody.appendChild(fragment);
        document.getElementById("infoMaestra").innerText = `Registros: ${unicos.size}`;
    } catch (e) { alert("Error en consulta"); }
    hideLoader();
};

document.getElementById("btnCargarProductos").onclick = async () => {
    showLoader("Cargando catálogo...");
    const s = await getDocs(query(collection(db, "productos"), orderBy("producto")));
    const b = document.querySelector("#productsTable tbody");
    b.innerHTML = "";
    s.forEach(d => { 
        const p = d.data(); 
        b.innerHTML += `<tr><td>${p.producto}</td><td><img src="assets/productos/${p.producto}.png" style="width:40px;" onerror="this.src='https://via.placeholder.com/50'"></td><td>${p.coins}</td></tr>`; 
    });
    hideLoader();
};

document.getElementById("btnCargarCompras").onclick = async () => {
    showLoader("Cargando historial...");
    const tbody = document.querySelector("#comprasTable tbody");
    tbody.innerHTML = "";
    const s = await getDocs(query(collection(db, "compras"), orderBy("fecha", "desc"), limit(200)));
    s.forEach(doc => {
        const d = doc.data();
        const f = d.fecha ? d.fecha.toDate().toLocaleDateString() : "---";
        tbody.innerHTML += `<tr><td>${f}</td><td>${d.codVendedor}</td><td>${d.nombre}</td><td>${d.cedis}</td><td>${d.items.map(i=>i.nombre).join(", ")}</td><td>${d.total}</td></tr>`;
    });
    hideLoader();
};

document.getElementById("btnCargarMovs").onclick = async () => {
    const cod = document.getElementById("inputMovsCod").value.trim();
    if(!cod) return alert("Ingresa un código");
    showLoader("Calculando saldos...");
    const tbody = document.querySelector("#movTable tbody");
    tbody.innerHTML = "";
    const [s1, s2] = await Promise.all([
        getDocs(query(collection(db, "usuariosPorFecha"), where("codVendedor", "==", cod))),
        getDocs(query(collection(db, "compras"), where("codVendedor", "==", cod)))
    ]);
    let m = [];
    s1.forEach(d => m.push({ cod: d.data().codVendedor, nom: d.data().nombre, ceds: d.data().cedis, fec: d.data().fecha, con: "Carga", cns: d.data().coins_ganados }));
    s2.forEach(d => m.push({ cod: d.data().codVendedor, nom: d.data().nombre, ceds: d.data().cedis, fec: d.data().fecha.toDate().toISOString().slice(0,10), con: "Canje", cns: -d.data().total }));
    m.sort((a,b) => new Date(a.fec) - new Date(b.fec));
    let sal = 0;
    m.forEach(i => {
        sal += i.cns;
        tbody.innerHTML += `<tr><td>${i.cod}</td><td>${i.nom}</td><td>${i.ceds}</td><td>${i.fec}</td><td>${i.con}</td><td style="color:${i.cns>0?'green':'red'}">${i.cns}</td><td><b>${sal}</b></td></tr>`;
    });
    hideLoader();
};

document.getElementById("btnExportMaestra").onclick = () => exportarTablaACsv("maestraTable", "Maestro");
document.getElementById("btnExportProds").onclick = () => exportarTablaACsv("productsTable", "Inventario");
document.getElementById("btnExportCompras").onclick = () => exportarTablaACsv("comprasTable", "Canjes");
document.getElementById("btnExportMovs").onclick = () => exportarTablaACsv("movTable", "EstadoCuenta");
