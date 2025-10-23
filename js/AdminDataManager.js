import { REPORT_CONFIG, CRUD_FIELDS_CONFIG } from './config/tableConfigs.js';
import { ProductoService } from './services/ProductoService.js';
import { CategoriaService } from './services/CategoriaService.js';

const SERVICE_MAP = {
    'producto': ProductoService,
    'categoria': CategoriaService,
};

const OPTIONS_SERVICE_MAP = {
    'CategoriaService': CategoriaService,
};

// CONSTANTE FACTORIZADA: Define qué tablas pueden usar el botón "Crear Nuevo"
const TABLES_ALLOWING_CREATE = ['producto', 'categoria']; 

export class AdminDataManager {
    constructor(displayElementId, modalId = 'crud-modal') {
        this.displayElement = document.getElementById(displayElementId);
        this.modal = document.getElementById(modalId);
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');
        this.currentTable = null;

        this.fullData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentLinkText = '';

        this.loadingHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Cargando datos...</div>';

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

    enableCrudListeners(tableName) {
        // FACTORIZADO: Chequea la lista de tablas permitidas
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
                if (confirm(`¿Está seguro de eliminar?`)) {
                    this.softDelete(tableName, id);
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
        const totalPages = Math.ceil(this.fullData.length / this.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderCurrentPage();
        }
    }


    async loadTable(tableName, linkText) {
        this.displayElement.innerHTML = this.loadingHTML;
        const service = SERVICE_MAP[tableName];
        const config = REPORT_CONFIG[tableName];

        this.currentTable = tableName;
        this.currentLinkText = linkText;

        if (!config || !service) {
            this.displayElement.innerHTML = `<p class="error-message">❌ Configuración o Servicio no encontrado para la tabla: ${tableName}</p>`;
            return;
        }

        try {
            const data = await service.fetchData();

            this.fullData = data;
            this.currentPage = 1;

            this.renderCurrentPage();

        } catch (e) {
            console.error('Error al cargar datos:', e);
            this.displayElement.innerHTML = `<p class="error-message">❌ Error al cargar la tabla ${linkText}: ${e.message}</p>`;
        }
    }

    renderCurrentPage() {
        const tableName = this.currentTable;
        const linkText = this.currentLinkText;
        const config = REPORT_CONFIG[tableName];

        if (!config || !this.fullData) return;

        const totalRecords = this.fullData.length;
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;

        const dataSlice = this.fullData.slice(startIndex, endIndex);

        const filteredHeaders = this.getFilteredHeaders(tableName, config.headers);

        this.renderTable(tableName, linkText, dataSlice, true, filteredHeaders, totalRecords, totalPages);

        this.enableCrudListeners(tableName);
    }
    
    getFilteredHeaders(tableName, originalHeaders) {
        if (tableName === 'categoria') {
            return originalHeaders.filter(header => header.toLowerCase() !== 'visible');
        }
        return originalHeaders;
    }

    renderTable(tableName, linkText, dataSlice, isCrudTable, headers, totalRecords, totalPages) {
        // FACTORIZADO: Chequea la lista de tablas permitidas
        const allowCreate = TABLES_ALLOWING_CREATE.includes(tableName);
        const recordText = 'registros visibles';

        if (!dataSlice || dataSlice.length === 0) {
            this.displayElement.innerHTML = `
                <div class="table-actions">
                    <h2>Gestión de la Tabla: ${linkText}</h2>
                    ${isCrudTable && allowCreate ?
                    `<button class="btn-primary btn-create" data-table="${tableName}"><i class="fas fa-plus"></i> Crear Nuevo</button>` : ''
                }
                    <span class="record-count">Total: 0 ${recordText}</span>
                </div>
                <p class="info-message">No se encontraron ${recordText} en la tabla ${tableName}.</p>
            `;
            return;
        }

        const currentDataLength = dataSlice.length;

        let tableHTML = `
                <div class="table-actions">
                    <h2>Gestión de la Tabla: ${linkText}</h2>
                    ${isCrudTable && allowCreate ?
                `<button class="btn-primary btn-create" data-table="${tableName}"><i class="fas fa-plus"></i> Crear Nuevo</button>` : ''
            }
                    <span class="record-count">Total: ${totalRecords} ${recordText} (${currentDataLength} en esta página)</span>
                </div>
                <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${header.toUpperCase()}</th>`).join('')}
                            ${isCrudTable ? '<th>ACCIONES</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${dataSlice.map(row => this.renderRow(row, tableName, isCrudTable)).join('')}
                    </tbody>
                </table>
                </div>
                ${this._renderPaginationControls(totalPages)}
            `;

        this.displayElement.innerHTML = tableHTML;
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

    renderRow(row, tableName, isCrudTable) {
        const config = REPORT_CONFIG[tableName];
        const rowId = row[config.id_key];

        const selectFields = config.select.split(',').map(field => field.trim());
        const idFieldName = config.id_key;

        let fieldsToRender = selectFields.filter(field => {
            const baseFieldName = field.split('!')[0].split(':')[0].trim();
            return baseFieldName !== idFieldName;
        });

        // FILTRO: Excluir 'visible' de la tabla 'categoria'
        if (tableName === 'categoria') {
            fieldsToRender = fieldsToRender.filter(field => {
                const baseFieldName = field.split('!')[0].split(':')[0].trim();
                return baseFieldName !== 'visible';
            });
        }

        let rowCells = fieldsToRender.map(field => {
            const baseFieldName = field.includes(':') ? field.split(':')[0] : field.split('!')[0];
            let cellValue = row[baseFieldName];

            if (tableName === 'producto') {

                if (baseFieldName === 'c' && row.c) {
                    cellValue = row.c.nombre;
                }
                else if (baseFieldName === 'imagen_url' && typeof cellValue === 'string' && cellValue) {
                    cellValue = `<img src="${cellValue}" alt="Producto" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">`;
                }
                else if (baseFieldName === 'precio') {
                    cellValue = `Bs. ${parseFloat(cellValue).toFixed(2)}`;
                }
                else if (baseFieldName === 'descripcion' && String(cellValue).length > 50) {
                    cellValue = String(cellValue).substring(0, 50) + '...';
                }
            } else if (tableName === 'categoria') {
                // Lógica de presentación para Categoría
            }

            cellValue = cellValue ?? '';

            return `<td>${cellValue}</td>`;
        }).join('');


        return `
            <tr data-id="${rowId}">
                <td>${rowId}</td>         ${rowCells}
                ${isCrudTable ? `
                    <td>
                        <button class="btn-action btn-edit" data-id="${rowId}" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-action btn-delete" data-id="${rowId}" title="Inhabilitar (Soft Delete)"><i class="fas fa-trash-alt"></i></button>
                    </td>
                ` : ''}
            </tr>
        `;
    }

    async softDelete(tableName, id) {
        const service = SERVICE_MAP[tableName];
        if (!service || !service.softDelete) return;

        try {
            await service.softDelete(id);
            alert('Registro eliminado correctamente. Recargando tabla...');

            this.loadTable(tableName, this.currentLinkText);
        } catch (e) {
            alert(`Error al inhabilitar el registro: ${e.message}`);
        }
    }


    async showForm(tableName, action, id = null) {
        const configForm = CRUD_FIELDS_CONFIG[tableName];
        const service = SERVICE_MAP[tableName];

        if (!configForm || !service) {
            alert(`Error: Configuración o Servicio no encontrado para la tabla ${tableName}.`);
            return;
        }
        
        // 1. 🛑 MODIFICACIÓN PARA EL TÍTULO DEL MODAL (Gramática) 🛑
        let titleText;
        const baseName = 'Categoría';
        const baseAction = action === 'create' ? 'Nueva' : 'Editar';
        
        if (tableName === 'categoria') {
            titleText = `${baseAction} ${baseName}`;
        } else {
            const formattedTableName = tableName.charAt(0).toUpperCase() + tableName.slice(1).toLowerCase();
            titleText = action === 'create'
                ? `Añadir Nuevo ${formattedTableName}`
                : `Editar ${formattedTableName}`;
        }

        this.modalTitle.textContent = titleText;
        this.modalBody.innerHTML = this.loadingHTML;

        let formData = {};

        if (action === 'edit' && id) {
            try {
                formData = await service.getById(id);
            } catch (e) {
                this.modalBody.innerHTML = `<p class="error-message">❌ Error al cargar datos del ID ${id}. ${e.message}</p>`;
                return;
            }
        }

        let selectOptionsPromises = [];
        // 2. 🛑 MODIFICACIÓN PARA FILTRAR EL CAMPO 'visible' DE CATEGORIA 🛑
        let filteredConfigForm = configForm;
        if (tableName === 'categoria') {
            filteredConfigForm = configForm.filter(field => field.name !== 'visible');
        }

        filteredConfigForm.forEach(field => {
        // 🛑 Usamos filteredConfigForm en lugar de configForm 🛑
            if (field.type === 'select' && field.options_service) {
                const optionsService = OPTIONS_SERVICE_MAP[field.options_service];
                if (optionsService && optionsService.getSelectOptions) {
                    selectOptionsPromises.push({
                        name: field.name,
                        promise: optionsService.getSelectOptions()
                    });
                }
            }
        });

        const selectOptionsResults = await Promise.all(selectOptionsPromises.map(p => p.promise));
        const selectOptionsMap = {};
        selectOptionsPromises.forEach((p, index) => {
            selectOptionsMap[p.name] = selectOptionsResults[index];
        });

        let formFieldsHTML = filteredConfigForm.map(field => {
        // 🛑 Usamos filteredConfigForm en lugar de configForm 🛑
            const currentValue = formData[field.name] ?? '';
            const requiredAttr = field.required ? 'required' : '';
            const stepAttr = field.step ? `step="${field.step}"` : '';
            const numberClass = field.type === 'number' ? ' input-number' : '';
            const placeholderText = `Ingrese ${field.label.toLowerCase().replace(/\s\(id\)/g, '')}`;
            const disabledAttr = field.disabled ? 'disabled' : '';

            if (field.type === 'hidden') {
                return `<input type="hidden" id="${field.name}" name="${field.name}" value="${currentValue}">`;
            }

            if (field.type === 'textarea') {
                return `
                    <div class="form-group form-group-textarea">
                        <label for="${field.name}">${field.label}:</label>
                        <textarea id="${field.name}" name="${field.name}" ${requiredAttr} ${disabledAttr} placeholder="${placeholderText}">${currentValue}</textarea>
                    </div>
                `;
            }

            else if (field.type === 'file') {
                const isEdit = action === 'edit' && formData['imagen_url'];
                return `
                    <div class="form-group form-group-file">
                        <label for="${field.name}">${field.label}:</label>
                        <input type="file" class="input-file" id="${field.name}" name="${field.name}" ${requiredAttr} accept="image/*" ${disabledAttr}>
                        ${isEdit ?
                        `<small class="info-file">Dejar vacío para mantener la imagen actual. 
                        <a href="${formData['imagen_url']}" target="_blank">Ver Imagen Actual</a></small>` : ''}
                    </div>
                `;
            }

            else if (field.type === 'select') {
                const options = selectOptionsMap[field.name] || [];
                let optionsHTML = `<option value="">-- Seleccionar ${field.label} --</option>`;

                const selectedId = formData[field.name];

                optionsHTML += options.map(option => {
                    const isSelected = String(option.value) === String(selectedId);
                    return `<option value="${option.value}" ${isSelected ? 'selected' : ''}>${option.text}</option>`;
                }).join('');

                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}:</label>
                        <select id="${field.name}" name="${field.name}" class="input-select" ${requiredAttr} ${disabledAttr}>
                            ${optionsHTML}
                        </select>
                    </div>
                `;
            }

            else {
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}:</label>
                        <input type="${field.type}" class="input-text${numberClass}" id="${field.name}" name="${field.name}" value="${currentValue}" ${requiredAttr} ${stepAttr} placeholder="${placeholderText}" ${disabledAttr}>
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

        document.getElementById('crud-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit(tableName, action, id);
        });

        document.getElementById('form-cancel-btn').addEventListener('click', () => {
            this.modal.classList.remove('active');
        });
    }

    async handleFormSubmit(tableName, action, id = null) {
        const form = document.getElementById('crud-form');
        const formData = new FormData(form);
        const service = SERVICE_MAP[tableName];

        if (!service) return;

        try {
            if (action === 'create') {
                await service.create(formData);
                alert(`Registro creado con éxito!`);
            } else {
                await service.update(id, formData);
                alert(`Registro actualizado con éxito!`);
            }

            this.modal.classList.remove('active');

            this.loadTable(this.currentTable, this.currentLinkText);

        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    }
}