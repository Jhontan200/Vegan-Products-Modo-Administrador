import { REPORT_CONFIG, CRUD_FIELDS_CONFIG } from './config/tableConfigs.js';
import { UsuarioService } from './services/UsuarioService.js';

const SERVICE_MAP = {
    'usuario': UsuarioService,
    // 'producto': ProductoService, 
    // 'categoria': CategoriaService,
};

const TABLES_ALLOWING_CREATE = ['usuario'];
// 🟢 NUEVO: ID para el contenedor que NO debe re-renderizarse
const SEARCH_FILTER_CONTAINER_ID = 'search-filter-controls-wrapper'; 

export class AdminUserManager {

    constructor(displayElementId, modalId = 'crud-modal') {
        this.displayElement = document.getElementById(displayElementId);
        this.modal = document.getElementById(modalId);
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');
        this.currentTable = 'usuario';

        this.sessionUserId = localStorage.getItem("usuarioId");

        this.fullData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentLinkText = 'Usuarios';
        this.currentSearchTerm = '';
        this.currentRoleFilter = 'todos'; 

        this.loadingHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Cargando datos...</div>';
        
        this.searchTimeout = null; 

        this.setupModalListeners();
    }

    setupModalListeners() {
        document.getElementById('close-modal-btn')?.addEventListener('click', () => {
            this.modal.classList.remove('active');
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target.id === this.modal.id) {
                this.modal.classList.remove('active');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.modal.classList.remove('active');
            }
        });
    }

    // 🟢 MODIFICADO: setupSearchAndFilterListeners (Ahora el listener es estable)
    setupSearchAndFilterListeners() {
        // Busca los elementos dentro del contenedor estable
        const searchContainer = document.getElementById(SEARCH_FILTER_CONTAINER_ID);
        if (!searchContainer) return;
        
        const searchInput = searchContainer.querySelector('#table-search-input');
        const roleFilterSelect = searchContainer.querySelector('#table-role-filter');

        // 1. Listener del Buscador (con Debounce)
        if (searchInput) {
            searchInput.value = this.currentSearchTerm;
            
            // Usamos oninput para sobrescribir y evitar la acumulación de listeners
            searchInput.oninput = () => {
                const newSearchTerm = searchInput.value;
            
                clearTimeout(this.searchTimeout);

                this.currentSearchTerm = newSearchTerm;

                // DEBOUNCE: Espera 300ms antes de ejecutar la búsqueda
                this.searchTimeout = setTimeout(() => {
                    
                    if (roleFilterSelect) {
                        this.currentRoleFilter = 'todos';
                        roleFilterSelect.value = 'todos';
                    }

                    this.currentPage = 1; 
                    this.renderCurrentPage();
                }, 300); 
            };
        }

        // 2. Listener del Filtro de Rol
        if (roleFilterSelect) {
            roleFilterSelect.value = this.currentRoleFilter;
            // Usamos onchange para sobrescribir y evitar la acumulación de listeners
            roleFilterSelect.onchange = () => {
                this.currentRoleFilter = roleFilterSelect.value;

                if (searchInput) {
                    clearTimeout(this.searchTimeout); 
                    this.currentSearchTerm = '';
                    searchInput.value = '';
                }

                this.currentPage = 1;
                this.renderCurrentPage();
            };
        }
    }

    enableCrudListeners(tableName) {
        const allowCreate = TABLES_ALLOWING_CREATE.includes(tableName);

        if (allowCreate) {
            this.displayElement.querySelector('.btn-create')?.addEventListener('click', () => {
                this.showForm(tableName, 'create');
            });
        }

        this.displayElement.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.showForm(tableName, 'edit', id);
            });
        });

        this.displayElement.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;

                if (id === this.sessionUserId) {
                    alert('Restricción de seguridad: No puede eliminar su propia cuenta de sesión.');
                    return;
                }

                if (confirm(`¿Está seguro de eliminar?`)) {
                    this.toggleVisibility(id, false);
                }
            });
        });

        this.setupPaginationListeners();
    }

    setupPaginationListeners() {
        this.displayElement.querySelectorAll('.btn-pagination').forEach(button => {
            button.addEventListener('click', (e) => {
                const page = parseInt(e.currentTarget.dataset.page);
                this.goToPage(page);
            });
        });

        this.displayElement.querySelectorAll('.btn-pagination-nav').forEach(button => {
            button.addEventListener('click', (e) => {
                const nav = e.currentTarget.dataset.nav;
                const newPage = nav === 'prev' ? this.currentPage - 1 : this.currentPage + 1;
                this.goToPage(newPage);
            });
        });
    }

    goToPage(page) {
        // Usa la longitud de los datos FILTRADOS para calcular las páginas.
        const filteredData = this.filterData();
        const totalPages = Math.ceil(filteredData.length / this.itemsPerPage);

        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderCurrentPage();
        }
    }

    async toggleVisibility(id, isVisible) {
        if (isVisible === true) return;

        const tableName = this.currentTable;
        const service = SERVICE_MAP[tableName];
        if (!service || !service.update) return;

        if (!isVisible && id === this.sessionUserId) {
            alert('Restricción de seguridad: No se permite inhabilitar la cuenta de la sesión actual.');
            return;
        }

        try {
            const updatePayload = {
                visible: false
            };

            console.log(`[DEBUG - AdminUserManager] Llamando a service.update para inhabilitar ID: ${id}`);
            console.log('[DEBUG - AdminUserManager] Payload enviado (Soft Delete):', updatePayload);

            await service.update(id, updatePayload);

            alert(`Registro eliminado correctamente. Recargando tabla...`);

            this.loadTable();
        } catch (e) {
            alert(`Error al guardar el estado del registro: ${e.message}`);
        }
    }

    // Lógica de filtrado de datos (buscador + filtro de rol)
    filterData() {
        let data = this.fullData;
        const term = this.currentSearchTerm.toLowerCase().trim();
        const role = this.currentRoleFilter;
        const tableName = this.currentTable;

        // 1. Filtrar por Rol (si no es 'todos')
        if (role !== 'todos' && tableName === 'usuario') {
            data = data.filter(row => row.rol && row.rol.toLowerCase() === role);
        }

        // 2. Filtrar por Término de Búsqueda (si existe)
        if (term) {
            if (tableName === 'usuario') {
                // Ajustado para buscar solo por nombres, apellidos o CI
                return data.filter(row => {
                    const nombreCompleto = `${row.primer_nombre || ''} ${row.segundo_nombre || ''} ${row.apellido_paterno || ''} ${row.apellido_materno || ''}`.toLowerCase();
                    const ci = String(row.ci || '').toLowerCase();
                    
                    return nombreCompleto.includes(term) || ci.includes(term);
                });
            }
            // Puedes agregar lógica de búsqueda para otras tablas aquí si es necesario
        }

        return data; // Retorna los datos filtrados por rol o los datos completos
    }

    // 🟢 NUEVO: Actualiza solo el cuerpo de la tabla para búsqueda y paginación rápida
    _updateTableBodyOnly(dataSlice, isCrudTable, indexOffset) {
        const tableBody = this.displayElement.querySelector('.data-table tbody');
        const paginationControls = this.displayElement.querySelector('.pagination-controls');
        const recordCountSpan = this.displayElement.querySelector('.record-count');
        
        const tableName = this.currentTable;
        const totalRecords = this.filterData().length;
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);

        if (recordCountSpan) {
            recordCountSpan.textContent = `Total: ${totalRecords} registros visibles (${dataSlice.length} en esta página)`;
        }

        // 1. Reemplazar cuerpo de la tabla
        if (tableBody) {
            tableBody.innerHTML = dataSlice.map((row, index) => 
                this.renderRow(row, tableName, isCrudTable, indexOffset + index)
            ).join('');
        }
        
        // 2. Reemplazar paginación
        if (paginationControls) {
            paginationControls.outerHTML = this._renderPaginationControls(totalPages);
        }

        // 3. Reestablecer listeners
        this.enableCrudListeners(tableName);
    }

    // 🟢 MODIFICADO: Carga inicial y configura el listener de búsqueda UNA SOLA VEZ
    async loadTable() {
        const tableName = this.currentTable;
        const linkText = this.currentLinkText;

        // Pre-renderiza la estructura básica con contenedores estables
        this.displayElement.innerHTML = `
            <div class="table-actions">
                <h2>Gestión de la Tabla: ${linkText}</h2>
                <button class="btn-primary btn-create" data-table="${tableName}"><i class="fas fa-plus"></i> Crear Nuevo</button>
                <span class="record-count">Cargando...</span>
            </div>
            ${this._renderSearchAndFilterBox(tableName)}
            <div id="table-content-wrapper">
                ${this.loadingHTML}
            </div>
        `;

        // 🟢 Configura los listeners del buscador y filtro aquí, solo una vez.
        this.setupSearchAndFilterListeners();
        
        const service = SERVICE_MAP[tableName];
        const config = REPORT_CONFIG[tableName];
        const tableContentWrapper = this.displayElement.querySelector('#table-content-wrapper');

        if (!config || !service) {
            tableContentWrapper.innerHTML = `<p class="error-message">Configuración o Servicio no encontrado para la tabla: ${tableName}</p>`;
            return;
        }

        try {
            const data = await service.fetchData();
            this.fullData = data;
            this.currentPage = 1;
            this.currentSearchTerm = '';
            this.currentRoleFilter = 'todos'; 
            
            this.renderCurrentPage();

        } catch (e) {
            console.error('Error al cargar datos:', e);
            tableContentWrapper.innerHTML = `<p class="error-message">Error al cargar la tabla ${linkText}: ${e.message}</p>`;
        }
    }

    // 🟢 MODIFICADO: Usa _updateTableBodyOnly para actualizaciones rápidas
    renderCurrentPage() {
        const tableName = this.currentTable;
        const linkText = this.currentLinkText;
        const config = REPORT_CONFIG[tableName];

        if (!config || !this.fullData) return;

        const filteredData = this.filterData();

        const totalRecords = filteredData.length;
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;

        const dataSlice = filteredData.slice(startIndex, endIndex);

        const tableWrapper = this.displayElement.querySelector('#table-content-wrapper');
        // Chequea si la tabla ya está dibujada
        const isTableDrawn = tableWrapper && tableWrapper.querySelector('.data-table');

        if (!isTableDrawn || dataSlice.length === 0 && this.currentSearchTerm) {
            // Si es la carga inicial o no hay resultados, renderiza toda la estructura de la tabla (dentro del wrapper)
            this.renderTable(tableName, linkText, dataSlice, true, this.getFixedHeaders(), totalRecords, totalPages);
            this.enableCrudListeners(tableName);
        } else {
            // OPTIMIZACIÓN CLAVE: Solo actualiza el cuerpo y la paginación
            this._updateTableBodyOnly(dataSlice, true, startIndex);
        }
    }

    getFixedHeaders() {
        if (this.currentTable === 'usuario') {
            return [
                'N°',
                'CI',
                'NOMBRES',
                'APELLIDOS',
                'ROL',
                'CORREO ELECTRÓNICO',
                'CONTRASEÑA',
            ];
        } 
        return [];
    }

    // 🟢 MODIFICADO: renderTable ahora solo se enfoca en el contenido de la tabla y la paginación (dentro del wrapper)
    renderTable(tableName, linkText, dataSlice, isCrudTable, headers, totalRecords, totalPages) {
        const recordText = 'registros visibles';
        const tableContentWrapper = this.displayElement.querySelector('#table-content-wrapper');

        // Actualizar el conteo de registros en el header
        const recordCountSpan = this.displayElement.querySelector('.record-count');
        if (recordCountSpan) {
             recordCountSpan.textContent = `Total: ${totalRecords} ${recordText} (${dataSlice.length} en esta página)`;
        }
        
        // Manejar caso de no resultados
        if (!dataSlice || dataSlice.length === 0) {
            tableContentWrapper.innerHTML = `<p class="info-message">No se encontraron ${recordText} en la tabla ${tableName}.</p>`;
            return;
        }

        // Generar el HTML de la tabla y la paginación
        let tableHTML = `
                <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${header.toUpperCase()}</th>`).join('')}
                            ${isCrudTable ? '<th>ACCIONES</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${dataSlice.map((row, index) => this.renderRow(row, tableName, isCrudTable, (this.currentPage - 1) * this.itemsPerPage + index)).join('')}
                    </tbody>
                </table>
                </div>
                ${this._renderPaginationControls(totalPages)}
            `;

        tableContentWrapper.innerHTML = tableHTML;
    }

    // 🟢 MODIFICADO: Renderiza el filtro y búsqueda dentro del ID estable
    _renderSearchAndFilterBox(tableName) {
        if (tableName !== 'usuario') return ''; 

        const searchInstructions = 'Busca por Nombre, Apellido o C.I.';

        const roles = [
            { value: 'todos', text: 'Todos los Roles' },
            { value: 'cliente', text: 'Cliente' },
            { value: 'empleado', text: 'Empleado' },
            { value: 'administrador', text: 'Administrador' }
        ];

        const roleOptionsHTML = roles.map(role => {
            const isSelected = role.value === this.currentRoleFilter;
            return `<option value="${role.value}" ${isSelected ? 'selected' : ''}>${role.text}</option>`;
        }).join('');

        return `
            <div id="${SEARCH_FILTER_CONTAINER_ID}" class="filter-controls-container">
                <div class="search-box">
                    <div class="input-group">
                        <input type="text" id="table-search-input" placeholder="${searchInstructions}" class="input-text-search" value="${this.currentSearchTerm}">
                        <i class="fas fa-search search-icon"></i>
                    </div>
                </div>
                <div class="role-filter-box">
                    <label for="table-role-filter">Filtrar por Rol:</label>
                    <select id="table-role-filter" class="input-select-filter">
                        ${roleOptionsHTML}
                    </select>
                </div>
            </div>
        `;
    }

    _renderPaginationControls(totalPages) {
        if (totalPages <= 1) return '';
        let buttonsHTML = '';
        const maxButtons = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? 'active' : '';
            buttonsHTML += `<button class="btn-pagination ${activeClass}" data-page="${i}">${i}</button>`;
        }

        return `
            <div class="pagination-controls">
                <button class="btn-pagination-nav" data-nav="prev" ${this.currentPage === 1 ? 'disabled' : ''}>&laquo; Anterior</button>
                ${buttonsHTML}
                <button class="btn-pagination-nav" data-nav="next" ${this.currentPage === totalPages ? 'disabled' : ''}>Siguiente &raquo;</button>
                <span class="page-info">Página ${this.currentPage} de ${totalPages}</span>
            </div>
        `;
    }

    // MODIFICADO: Añadir la clase de estilo por rol a la fila
    renderRow(row, tableName, isCrudTable, index) {
        const config = REPORT_CONFIG[tableName];
        const rowId = row[config.id_key];

        const rowNumber = index + 1; // El cálculo completo del N° se pasa desde el llamador

        const finalFields = [
            'ci',
            'nombre_completo',
            'apellido_completo',
            'rol',
            'correo_electronico',
            'contrasena_display',
        ];

        const isSelf = rowId === this.sessionUserId;
        const isInactive = !row['visible'];
        const userRole = row['rol'] ? row['rol'].toLowerCase() : 'desconocido'; // Rol para la clase

        const deleteDisabled = isSelf || isInactive;
        const deleteTitle = isSelf ? 'No puedes inhabilitar tu propia cuenta' : (isInactive ? 'Registro Inhabilitado' : 'Inhabilitar (Soft Delete)');


        let rowCells = finalFields.map(fieldName => {
            let cellValue;

            if (fieldName === 'nombre_completo') {
                const primer = row.primer_nombre || '';
                const segundo = row.segundo_nombre || '';
                cellValue = `${primer} ${segundo}`.trim();
            } else if (fieldName === 'apellido_completo') {
                const paterno = row.apellido_paterno || '';
                const materno = row.apellido_materno || '';
                cellValue = `${paterno} ${materno}`.trim();
            } else if (fieldName === 'contrasena_display') {
                cellValue = '********';
            } else {
                cellValue = row[fieldName] ?? '';
            }

            return `<td>${cellValue}</td>`;
        }).join('');

        // Clases para el estilo de la fila: inactivo + clase de rol
        const roleClass = `role-${userRole}`;
        const rowClass = `${isInactive ? 'inactive-record' : ''} ${roleClass}`;

        return `
            <tr data-id="${rowId}" class="${rowClass}">
                <td>${rowNumber}</td>
                ${rowCells}
                ${isCrudTable ? `
                    <td>
                        <button class="btn-action btn-edit" data-id="${rowId}" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-action btn-delete" data-id="${rowId}" title="${deleteTitle}" ${deleteDisabled ? 'disabled' : ''}>
                               <i class="fas fa-trash-alt"></i>
                             </button>
                    </td>
                ` : ''}
            </tr>
        `;
    }

    async showForm(tableName, action, id = null) {
        const configForm = CRUD_FIELDS_CONFIG[tableName];
        const service = SERVICE_MAP[tableName];

        if (!configForm || !service) {
            alert(`Error: Configuración o Servicio no encontrado para la tabla ${tableName}.`);
            return;
        }

        const titleText = action === 'create' ? 'Nuevo Usuario' : 'Editar Usuario';

        this.modalTitle.textContent = titleText;
        this.modalBody.innerHTML = this.loadingHTML;

        let formData = {};

        if (action === 'edit' && id) {
            try {
                formData = await service.getById(id);
            } catch (e) {
                this.modalBody.innerHTML = `<p class="error-message">Error al cargar datos del ID ${id}. ${e.message}</p>`;
                return;
            }
        }

        const filteredConfigForm = configForm.filter(field => field.name !== 'visible');

        // CAMBIO 1: Incluir el rol 'empleado'
        const availableRoles = [
            { value: 'cliente', text: 'Cliente' },
            { value: 'empleado', text: 'Empleado' }, // Nuevo Rol
            { value: 'administrador', text: 'Administrador' }
        ];

        let formFieldsHTML = filteredConfigForm.map(field => {
            let currentValue = formData[field.name] ?? '';
            let fieldConfig = { ...field };

            if (fieldConfig.name === 'contrasena') {
                if (action === 'edit') {
                    currentValue = '';
                }
            }

            const requiredAttr = fieldConfig.required ? 'required' : '';
            const stepAttr = fieldConfig.step ? `step="${fieldConfig.step}"` : '';
            const numberClass = fieldConfig.type === 'number' ? ' input-number' : '';
            const placeholderText = fieldConfig.placeholder || `Ingrese ${fieldConfig.label.toLowerCase().replace(/\s\(id\)/g, '')}`;
            // Base disabled attribute from config
            const disabledAttrBase = fieldConfig.disabled ? 'disabled' : '';

            let finalRequiredAttr = requiredAttr;
            if (fieldConfig.name === 'contrasena' && action === 'edit' && requiredAttr) {
                finalRequiredAttr = '';
            }

            const passwordHelp = '';

            if (fieldConfig.type === 'hidden') {
                return `<input type="hidden" id="${fieldConfig.name}" name="${fieldConfig.name}" value="${currentValue}">`;
            }

            // Bloque para el Selector de Rol (type: select o name: rol)
            if (fieldConfig.type === 'select' || fieldConfig.name === 'rol') {

                let options = [];
                if (fieldConfig.name === 'rol') {
                    options = availableRoles;
                }

                let optionsHTML = `<option value="">-- Seleccionar ${fieldConfig.label} --</option>`;

                const selectedValue = formData[fieldConfig.name];

                // RESTRICCIÓN ELIMINADA: El campo de rol ahora está siempre habilitado
                const finalDisabledAttr = '';

                optionsHTML += options.map(option => {
                    const isSelected = String(option.value) === String(selectedValue);
                    return `<option value="${option.value}" ${isSelected ? 'selected' : ''}>${option.text}</option>`;
                }).join('');

                return `
                    <div class="form-group">
                        <label for="${fieldConfig.name}">${fieldConfig.label}:</label>
                        <select id="${fieldConfig.name}" name="${fieldConfig.name}" class="input-select" ${requiredAttr} ${finalDisabledAttr}>
                            ${optionsHTML}
                        </select>
                    </div>
                `;
            }
            // Bloque para el campo de contraseña con toggle de imagen
            else if (fieldConfig.name === 'contrasena') {
                return `
                    <div class="form-group">
                        <label for="${fieldConfig.name}" class="label">${fieldConfig.label}:</label>
                        <div style="position: relative;">
                            <input type="password" id="${fieldConfig.name}" name="${fieldConfig.name}" class="input-text" value="${currentValue}" ${finalRequiredAttr} placeholder="${placeholderText}">
                            <span class="password-toggle-icon" data-target-id="${fieldConfig.name}"
                                style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; height: 24px; width: 24px; display: flex; align-items: center; justify-content: center;">
                                
                                <img class="eye-open" src="imagenes/ojo_abierto.png" alt="ojo abierto"
                                    style="max-width: 100%; max-height: 100%; display: block;">
                                <img class="eye-closed" src="imagenes/ojo_cerrado.png" alt="ojo cerrado"
                                    style="max-width: 100%; max-height: 100%; display: none;">
                            </span>
                        </div>
                        ${passwordHelp}
                    </div>
                `;

            }
            // Renderizado genérico para otros campos
            else {
                return `
                    <div class="form-group">
                        <label for="${fieldConfig.name}">${fieldConfig.label}:</label>
                        <input type="${fieldConfig.type}" class="input-text${numberClass}" id="${fieldConfig.name}" name="${fieldConfig.name}" value="${currentValue}" ${finalRequiredAttr} ${stepAttr} placeholder="${placeholderText}" ${disabledAttrBase}>
                        ${passwordHelp}
                    </div>
                `;
            }
        }).join('');

        const formHTML = `
            <form id="crud-form">
                ${formFieldsHTML}
                <div class="form-footer">
                    <button type="submit" class="btn-primary-modal">
                        <i class="fas fa-save"></i> ${action === 'create' ? 'Crear' : 'Guardar Cambios'}
                    </button>
                    <button type="button" class="btn-cancel-modal" id="form-cancel-btn">Cancelar</button>
                </div>
            </form>
        `;

        this.modalBody.innerHTML = formHTML;

        this.modal.classList.add('active');

        this.setupPasswordToggleListeners();

        document.getElementById('crud-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit(tableName, action, id);
        });

        document.getElementById('form-cancel-btn').addEventListener('click', () => {
            this.modal.classList.remove('active');
        });
    }

    setupPasswordToggleListeners() {
        this.modalBody.querySelectorAll('.password-toggle-icon').forEach(iconContainer => {
            iconContainer.addEventListener('click', (e) => {
                const targetId = iconContainer.dataset.targetId;
                const passwordInput = document.getElementById(targetId);

                if (!passwordInput) return;

                const iconOpen = iconContainer.querySelector('.eye-open');
                const iconClosed = iconContainer.querySelector('.eye-closed');

                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    iconOpen.style.display = 'none';
                    iconClosed.style.display = 'block';
                } else {
                    passwordInput.type = 'password';
                    iconOpen.style.display = 'block';
                    iconClosed.style.display = 'none';
                }
            });
        });
    }

    async handleFormSubmit(tableName, action, id = null) {
        const form = document.getElementById('crud-form');
        const formData = new FormData(form);
        const service = SERVICE_MAP[tableName];

        if (!service) return;

        // 1. Obtener los valores del formulario
        const primer_nombre = formData.get('primer_nombre')?.trim();
        const segundo_nombre = formData.get('segundo_nombre')?.trim();
        const apellido_paterno = formData.get('apellido_paterno')?.trim();
        const apellido_materno = formData.get('apellido_materno')?.trim();
        const ci = formData.get('ci')?.trim();
        const celular = formData.get('celular')?.trim();
        const email = formData.get('correo_electronico')?.trim();
        const password = formData.get('contrasena')?.trim();

        // Obtener el rol
        let rol = formData.get('rol');

        // 2. PATRONES DE VALIDACIÓN
        const soloLetras = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
        const soloNumeros = /^[0-9]+$/;
        const correoUniversal = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const passwordSegura = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        // 3. VALIDACIONES
        if (!primer_nombre || !apellido_paterno || !apellido_materno || !ci || !celular || !email || !rol || (action === 'create' && !password)) {
            alert("Todos los campos obligatorios deben ser llenados.");
            return;
        }

        if (!soloLetras.test(primer_nombre)) {
            alert("El primer nombre solo puede contener letras."); return;
        }
        if (segundo_nombre && !soloLetras.test(segundo_nombre)) {
            alert("El segundo nombre solo puede contener letras."); return;
        }
        if (!soloLetras.test(apellido_paterno) || !soloLetras.test(apellido_materno)) {
            alert("Los apellidos solo pueden contener letras."); return;
        }

        // CI y Celular
        if (!soloNumeros.test(ci) || ci.length !== 7) {
            alert("El C.I. debe contener exactamente 7 dígitos."); return;
        }
        if (!soloNumeros.test(celular) || celular.length !== 8) {
            alert("El celular debe contener exactamente 8 dígitos."); return;
        }

        // Correo
        if (!correoUniversal.test(email)) {
            alert("Debe ingresar un correo válido."); return;
        }

        // Contraseña
        if (action === 'create' && !passwordSegura.test(password)) {
            alert("La contraseña es insegura. Debe tener al menos 8 caracteres, incluir una mayúscula, un número y un carácter especial (@$!%*?&)."); return;
        }
        if (action === 'edit' && password && !passwordSegura.test(password)) {
            alert("Si intentas cambiar la contraseña, esta es insegura. Debe cumplir con el requisito de al menos 8 caracteres, mayúscula, número y carácter especial (@$!%*?&)."); return;
        }

        // Se eliminan las comprobaciones de rol y el manejo del campo oculto.
        formData.delete('rol_hidden');

        try {
            if (action === 'create') {
                const debugPayload = {};
                for (let pair of formData.entries()) { debugPayload[pair[0]] = pair[1]; }
                console.log(`[DEBUG - AdminUserManager] Payload enviado para CREAR usuario:`, debugPayload);

                await service.create(formData);
                alert(`Registro creado con éxito!`);
            } else {
                const debugPayload = {};
                for (let pair of formData.entries()) { debugPayload[pair[0]] = pair[1]; }
                console.log(`[DEBUG - AdminUserManager] Payload enviado para ACTUALIZAR ID ${id}:`, debugPayload);

                await service.update(id, formData);
                alert(`Registro actualizado con éxito!`);
            }

            this.modal.classList.remove('active');

            this.loadTable();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    }
}