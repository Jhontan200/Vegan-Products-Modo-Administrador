import { AdminProductManager } from './AdminProductManager.js';
import { AdminCategoryManager } from './AdminCategoryManager.js';
import { AdminUserManager } from './AdminUserManager.js';
import { AdminDireccionManager } from './AdminDireccionManager.js';
import { AdminOrdenManager } from './AdminOrdenManager.js';
import { AdminOrdenDetalleManager } from './AdminOrdenDetalleManager.js';
import { AdminDepartamentoManager } from './AdminDepartamentoManager.js';
import { AdminMunicipioManager } from './AdminMunicipioManager.js';
import { AdminLocalidadManager } from './AdminLocalidadManager.js';
import { AdminZonaManager } from './AdminZonaManager.js';
import { AuthManager } from './authManager.js';


document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-btn');
    const navLinks = document.querySelectorAll('.nav-link');
    const logoutLink = document.getElementById('logout-link');

    const authManager = new AuthManager();

    const displayElementId = 'content-display';
    const modalId = 'crud-modal';

    let currentManager = null; 

    const productManager = new AdminProductManager(displayElementId, modalId);
    const categoryManager = new AdminCategoryManager(displayElementId, modalId);
    const userManager = new AdminUserManager(displayElementId, modalId);
    const direccionManager = new AdminDireccionManager(displayElementId, modalId);
    const ordenManager = new AdminOrdenManager(displayElementId, modalId);
    const ordenDetalleManager = new AdminOrdenDetalleManager(displayElementId, modalId);
    const departamentoManager = new AdminDepartamentoManager(displayElementId, modalId);
    const municipioManager = new AdminMunicipioManager(displayElementId, modalId);
    const localidadManager = new AdminLocalidadManager(displayElementId, modalId);
    const zonaManager = new AdminZonaManager(displayElementId, modalId);

    const icon = toggleBtn.querySelector('i');
    if (!sidebar.classList.contains('collapsed')) {
        icon.classList.add('fa-times');
        icon.classList.remove('fa-bars');
    }

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        } else {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        }
    });

    const managerMap = {
        'producto': productManager,
        'categoria': categoryManager,
        'usuario': userManager,
        'direccion': direccionManager,
        'orden': ordenManager,
        'orden_detalle': ordenDetalleManager,
        'departamento': departamentoManager,
        'municipio': municipioManager,
        'localidad': localidadManager,
        'zona': zonaManager
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const tableName = link.getAttribute('data-table');
            const newManager = managerMap[tableName];

            if (newManager && newManager.loadTable) {
                
                if (currentManager && currentManager !== newManager && typeof currentManager.cleanupListeners === 'function') {
                    currentManager.cleanupListeners();
                }
                
                newManager.loadTable();
                
                currentManager = newManager;
                
                console.log(`[Router] Cargando tabla ${tableName} con su Manager especializado.`);

            } else {
                const linkText = link.querySelector('span').textContent.trim();
                document.getElementById(displayElementId).innerHTML = `
                    <p class="info-message">Gestión no disponible para ${linkText} (tabla: ${tableName}).</p>
                `;
                console.warn(`[Router] No hay Manager definido para la tabla: ${tableName}`);
            }
        });
    });

    logoutLink.addEventListener('click', async (event) => {
        event.preventDefault();

        localStorage.removeItem("usuarioEmail");
        localStorage.removeItem("usuarioId");
        localStorage.removeItem("usuarioRol");
        
        if (currentManager && typeof currentManager.cleanupListeners === 'function') {
            currentManager.cleanupListeners();
        }

        const result = await authManager.cerrarSesion();

        if (result.success) {
            window.location.href = "index.html";
        } else {
            console.error("Error al cerrar sesión:", result.error);
            alert("⚠️ Error al cerrar sesión. Intenta de nuevo.");
        }
    });

    productManager.loadTable();
    currentManager = productManager;
    console.log('[Router] Carga inicial: Tabla Productos.');

    const productNavLink = document.querySelector('.nav-list li a[data-table="producto"]');
    if (productNavLink) {
        productNavLink.classList.add('active');
    }
});