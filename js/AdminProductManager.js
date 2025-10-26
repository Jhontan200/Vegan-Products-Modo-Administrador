import { REPORT_CONFIG, CRUD_FIELDS_CONFIG } from './config/tableConfigs.js';
import { ProductoService } from './services/ProductoService.js';
import { CategoriaService } from './services/CategoriaService.js';

const SERVICE_MAP = {
    'producto': ProductoService,
    'categoria': CategoriaService,
};

const TABLES_ALLOWING_CREATE = ['producto'];
const SEARCH_FILTER_CONTAINER_ID = 'product-search-filter-controls-wrapper';

export class AdminProductManager {

    constructor(displayElementId, modalId = 'crud-modal') {
        this.displayElement = document.getElementById(displayElementId);
        this.modal = document.getElementById(modalId);
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');

        this.currentTable = 'producto';
        this.currentLinkText = 'Productos';

        this.fullData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentSearchTerm = '';

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

    filterData() {
        let data = this.fullData;
        const term = this.currentSearchTerm.toLowerCase().trim();

        if (term) {
            return data.filter(row => {
                const nombre = String(row.nombre || '').toLowerCase();
                const descripcion = String(row.descripcion || '').toLowerCase();

                return nombre.includes(term) || descripcion.includes(term);
            });
        }
        return data;
    }

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

        if (tableBody) {
            tableBody.innerHTML = dataSlice.map((row, index) =>
                this.renderRow(row, tableName, isCrudTable, indexOffset + index)
            ).join('');
        }

        if (paginationControls) {
            paginationControls.outerHTML = this._renderPaginationControls(totalPages);
        }

        this.enableCrudListeners(tableName);
    }

    async loadTable() {
        const tableName = this.currentTable;
        const linkText = this.currentLinkText;

        this.displayElement.innerHTML = `
            <div class="table-actions">
                <h2>Gestión de la Tabla: ${linkText}</h2>
                <button class="btn-primary btn-create" data-table="${tableName}"><i class="fas fa-plus"></i> Crear Nuevo</button>
                <span class="record-count">Cargando...</span>
            </div>
            ${this._renderSearchBox(tableName)}
            <div id="table-content-wrapper">
                ${this.loadingHTML}
            </div>
        `;

        this.setupSearchAndFilterListeners();

        const service = SERVICE_MAP[tableName];
        const config = REPORT_CONFIG[tableName];
        const tableContentWrapper = this.displayElement.querySelector('#table-content-wrapper');

        if (!config || !service) {
            tableContentWrapper.innerHTML = `<p class="error-message">Configuración o Servicio no encontrado para la tabla: ${tableName}</p>`;
            return;
        }

        try {
            const data = await service.fetchData(config.select);
            this.fullData = data;
            this.currentPage = 1;
            this.currentSearchTerm = '';
            this.renderCurrentPage();

        } catch (e) {
            console.error('Error al cargar datos de producto:', e);
            tableContentWrapper.innerHTML = `<p class="error-message">Error al cargar la tabla ${linkText}: ${e.message}</p>`;
        }
    }

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
        const isTableDrawn = tableWrapper && tableWrapper.querySelector('.data-table');

        if (!isTableDrawn || dataSlice.length === 0 && this.currentSearchTerm) {
            this.renderTable(tableName, linkText, dataSlice, true, config.headers, totalRecords, totalPages);
            this.enableCrudListeners(tableName);
        } else {
            this._updateTableBodyOnly(dataSlice, true, startIndex);
        }
    }

    renderRow(row, tableName, isCrudTable, indexOffset) {
        const config = REPORT_CONFIG[tableName];
        const rowId = row[config.id_key];
        const rowNumber = indexOffset + 1;

        const categoriaNombre = row.c ? row.c.nombre : 'N/A';
        const isInactive = row['visible'] === false;
        const rowClass = isInactive ? 'inactive-record' : '';
        const deleteTitle = isInactive ? 'Registro Eliminado/Inactivo' : 'Eliminar';

        let rowCells = `
            <td>${row.nombre ?? ''}</td>
            <td>${row.imagen_url ? `<img src="${row.imagen_url}" alt="Imagen" style="max-width: 50px; max-height: 50px; object-fit: cover;">` : 'Sin Imagen'}</td>
            <td>${(row.descripcion ?? '').substring(0, 50)}...</td>
            <td>Bs. ${parseFloat(row.precio ?? 0).toFixed(2)}</td>
              <td>${row.stock ?? 0}</td>
            <td>${categoriaNombre}</td>
        `;

        return `
            <tr data-id="${rowId}" class="${rowClass}">
                <td>${rowNumber}</td>
                ${rowCells}
                ${isCrudTable ? `
                    <td>
                        <button class="btn-action btn-edit" data-id="${rowId}" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-action btn-delete" data-id="${rowId}" title="${deleteTitle}" ${isInactive ? 'disabled' : ''}>
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                ` : ''}
            </tr>
        `;
    }

    renderTable(tableName, linkText, dataSlice, isCrudTable, headers, totalRecords, totalPages) {
        const recordText = 'registros visibles';
        const tableContentWrapper = this.displayElement.querySelector('#table-content-wrapper');

        const recordCountSpan = this.displayElement.querySelector('.record-count');
        if (recordCountSpan) {
             recordCountSpan.textContent = `Total: ${totalRecords} ${recordText} (${dataSlice.length} en esta página)`;
        }

        if (!dataSlice || dataSlice.length === 0) {
            tableContentWrapper.innerHTML = `<p class="info-message">No se encontraron ${recordText} en la tabla ${tableName}.</p>`;
            return;
        }

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

    _renderSearchBox(tableName) {
        const searchInstructions = 'Busca por Nombre o Categoría';
        return `
            <div id="${SEARCH_FILTER_CONTAINER_ID}" class="filter-controls-container">
                <div class="search-box full-width">
                    <div class="input-group">
                        <input type="text" id="table-search-input" placeholder="${searchInstructions}" class="input-text-search" value="${this.currentSearchTerm}">
                        <i class="fas fa-search search-icon"></i>
                    </div>
                </div>
            </div>
        `;
    }

    setupSearchAndFilterListeners() {
        const searchContainer = document.getElementById(SEARCH_FILTER_CONTAINER_ID);
        if (!searchContainer) return;

        const searchInput = searchContainer.querySelector('#table-search-input');

        if (searchInput) {
            searchInput.oninput = () => {
                this.currentSearchTerm = searchInput.value;

                clearTimeout(this.searchTimeout);

                this.searchTimeout = setTimeout(() => {
                    this.currentPage = 1;
                    this.renderCurrentPage();
                }, 300);
            };
        }
    }

    async showForm(tableName, action, id = null) {
        const configForm = CRUD_FIELDS_CONFIG[tableName];
        const service = SERVICE_MAP[tableName];

        if (!configForm || !service) {
            alert(`Error: Configuración o Servicio no encontrado para la tabla ${tableName}.`);
            return;
        }

        const titleText = action === 'create' ? 'Nuevo Producto' : 'Editar Producto';

        this.modalTitle.textContent = titleText;
        this.modalBody.innerHTML = this.loadingHTML;
        this.modal.classList.add('active');

        let formData = {};
        if (action === 'edit' && id) {
            try {
                formData = await service.getById(id);
            } catch (e) {
                this.modalBody.innerHTML = `<p class="error-message">Error al cargar datos del ID ${id}. ${e.message}</p>`;
                return;
            }
        }

        let categoryOptions = [];

        const categoryField = configForm.find(f => f.name === 'id_categoria' && f.type === 'select');
        if (categoryField) {
            const categoryService = SERVICE_MAP['categoria'];
            if (categoryService) {
                try {
                    categoryOptions = await categoryService.fetchData();
                } catch (e) {
                    console.error("Error al cargar categorías:", e);
                }
            }
        }


        const formFieldsHTML = configForm.map(field => {
            let currentValue = formData[field.name] ?? '';
            const requiredAttr = field.required ? 'required' : '';
            const stepAttr = field.step ? `step="${field.step}"` : '';
            const numberClass = field.type === 'number' ? ' input-number' : '';
            const placeholderText = field.placeholder || `Ingrese ${field.label.toLowerCase().replace(/\s\(id\)/g, '')}`;
            const disabledAttrBase = field.disabled ? 'disabled' : '';

            if (field.type === 'hidden') {
                return `<input type="hidden" id="${field.name}" name="${field.name}" value="${currentValue}">`;
            }

            if (field.name === 'file_upload') {
                const currentImage = formData.imagen_url || '';
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}:</label>
                        <input type="file" class="input-file" id="${field.name}" name="${field.name}" accept="image/png, image/jpeg" ${action === 'create' ? requiredAttr : ''}>
                        ${currentImage ? `<div class="image-preview" style="margin-top: 10px;">Imagen Actual: <img src="${currentImage}" style="max-width: 100px; max-height: 100px;"></div>` : ''}
                    </div>
                `;
            }

            if (field.type === 'select') {
                let optionsHTML = `<option value="">-- Seleccionar ${field.label} --</option>`;
                const selectedValue = formData[field.name];

                optionsHTML += categoryOptions.map(option => {
                    const isSelected = String(option.id) === String(selectedValue);
                    return `<option value="${option.id}" ${isSelected ? 'selected' : ''}>${option.nombre}</option>`;
                }).join('');

                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}:</label>
                        <select id="${field.name}" name="${field.name}" class="input-select" ${requiredAttr} ${disabledAttrBase}>
                            ${optionsHTML}
                        </select>
                    </div>
                `;
            }

            if (field.type === 'textarea') {
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}:</label>
                        <textarea class="input-textarea" id="${field.name}" name="${field.name}" ${requiredAttr} placeholder="${placeholderText}" ${disabledAttrBase}>${currentValue}</textarea>
                    </div>
                `;
            }

            return `
                <div class="form-group">
                    <label for="${field.name}">${field.label}:</label>
                    <input type="${field.type}" class="input-text${numberClass}" id="${field.name}" name="${field.name}" value="${currentValue}" ${requiredAttr} ${stepAttr} placeholder="${placeholderText}" ${disabledAttrBase}>
                </div>
            `;
        }).join('');

        const formHTML = `
            <form id="crud-form" enctype="multipart/form-data">
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

        const precio = parseFloat(formData.get('precio'));
        const stock = parseInt(formData.get('stock'));
        const id_categoria = formData.get('id_categoria');
        
        if (isNaN(precio) || precio <= 0) {
            alert('El precio debe ser un número positivo.'); return;
        }
        if (isNaN(stock) || stock < 0) {
            alert('El stock debe ser un número entero no negativo.'); return;
        }
        if (!id_categoria) {
            alert('Debe seleccionar una categoría.'); return;
        }

        try {
            if (action === 'create') {
                formData.append('visible', true); 
                await service.create(formData);
                alert(`¡El producto ha sido creado con éxito!`);
            } else {
                await service.update(id, formData);
                alert(`¡Los cambios en el producto han sido guardados con éxito!`);
            }

            this.modal.classList.remove('active');
            this.loadTable();
        } catch (error) {
            console.error('Error al guardar datos:', error);
            alert(`Error al guardar: ${error.message}`);
        }
    }

    async toggleVisibility(id, isVisible) {
        if (isVisible === false) return;

        const service = SERVICE_MAP[this.currentTable];
        if (!service || !service.update) return;

        try {
            await service.softDelete(id); 
            alert(`¡El producto ha sido eliminado del inventario correctamente! Recargando tabla...`);
            this.loadTable();
        } catch (e) {
            alert(`Error al eliminar el producto: ${e.message}`);
        }
    }

    enableCrudListeners(tableName) {
        this.displayElement.querySelector('.btn-create')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm(tableName, 'create');
        });

        this.displayElement.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.showForm(tableName, 'edit', id);
            });
        });

        this.displayElement.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const rowData = this.fullData.find(d => String(d[REPORT_CONFIG[tableName].id_key]) === id);

                const isVisible = rowData?.visible !== false;

                if (!isVisible) return;

                if (confirm(`¿Está seguro de que desea eliminar este producto?`)) {
                    this.toggleVisibility(id, isVisible);
                }
            });
        });

        this.setupPaginationListeners();
    }


    _renderPaginationControls(totalPages) {
        if (totalPages <= 1) return '';

        let pagesHtml = '';
        const maxPagesToShow = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? 'active' : '';
            pagesHtml += `<button class="page-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }

        return `
            <div class="pagination-controls">
                <button class="page-btn" id="first-page-btn" data-page="1" ${this.currentPage === 1 ? 'disabled' : ''}>&laquo;</button>
                <button class="page-btn" id="prev-page-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>&lt;</button>
                ${pagesHtml}
                <button class="page-btn" id="next-page-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>&gt;</button>
                <button class="page-btn" id="last-page-btn" data-page="${totalPages}" ${this.currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>
            </div>
        `;
    }

    setupPaginationListeners() {
        this.displayElement.querySelectorAll('.page-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const page = parseInt(e.currentTarget.getAttribute('data-page'));
                if (!isNaN(page) && page >= 1) {
                    this.goToPage(page);
                }
            });
        });
    }

    goToPage(page) {
        const totalRecords = this.filterData().length;
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);

        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderCurrentPage();
            this.displayElement.querySelector('.data-table')?.scrollIntoView({ behavior: 'smooth' });
        }
    }
}