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

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-btn');
    const navLinks = document.querySelectorAll('.nav-link');
    const logoutLink = document.getElementById('logout-link');

    // 🛑 1. Inicializar los Managers especializados 🛑
    const displayElementId = 'content-display';
    const modalId = 'crud-modal';

    // Instancias especializadas
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

    // Inicialización del ícono... 
    const icon = toggleBtn.querySelector('i');
    if (!sidebar.classList.contains('collapsed')) {
        icon.classList.add('fa-times');
        icon.classList.remove('fa-bars');
    }

    // 1. Funcionalidad de Colapsar/Expandir... 
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

    // 🛑 2. Funcionalidad de Navegación (Router) - Usando Mapas 🛑
    const managerMap = {
        'producto': productManager,
        'categoria': categoryManager,
        'usuario': userManager,
        'direccion': direccionManager,
        'orden': ordenManager,
        'orden_detalle': ordenDetalleManager,
        'departamento': departamentoManager,
        'municipio' : municipioManager,
        'localidad' : localidadManager,
        'zona' : zonaManager
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const tableName = link.getAttribute('data-table');
            const manager = managerMap[tableName];

            if (manager && manager.loadTable) {
                // Delegar la carga al Manager especializado
                manager.loadTable();
                console.log(`[Router] Cargando tabla ${tableName} con su Manager especializado.`);

            } else {
                // Manejo de tablas sin Manager (Reportes, etc.)
                const linkText = link.querySelector('span').textContent.trim();
                document.getElementById(displayElementId).innerHTML = `
                    <p class="info-message">Gestión no disponible para ${linkText} (tabla: ${tableName}).</p>
                `;
                console.warn(`[Router] No hay Manager definido para la tabla: ${tableName}`);
            }
        });
    });

    // 3. Funcionalidad de Cerrar Sesión... 

    // 🟢 CORRECCIÓN: Cargar la tabla de Productos al inicio de forma directa y robusta.

    // 1. Llamada directa y garantizada para cargar la tabla de Productos.
    productManager.loadTable();
    console.log('[Router] Carga inicial: Tabla Productos.');

    // 2. Asegurarse de que el enlace de 'Productos' se marque como activo.
    const productNavLink = document.querySelector('.nav-list li a[data-table="producto"]');
    if (productNavLink) {
        productNavLink.classList.add('active');
    }
});