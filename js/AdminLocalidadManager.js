import { REPORT_CONFIG, CRUD_FIELDS_CONFIG } from './config/tableConfigs.js';
import { LocalidadService } from './services/LocalidadService.js';
import { MunicipioService } from './services/MunicipioService.js';
import { DepartamentoService } from './services/DepartamentoService.js';

const SERVICE_MAP = {
    'localidad': LocalidadService,
    'municipio': MunicipioService,
    'departamento': DepartamentoService,
};

export class AdminLocalidadManager {

    constructor(displayElementId, modalId = 'crud-modal') {
        this.displayElement = document.getElementById(displayElementId);
        this.modal = document.getElementById(modalId);
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');

        this.currentTable = 'localidad';
        this.currentLinkText = 'Localidades';

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
                const nombreLocalidad = String(row.nombre || '').toLowerCase();
                const nombreMunicipio = String(row.municipio?.nombre || '').toLowerCase();

                return nombreLocalidad.includes(term) || nombreMunicipio.includes(term);
            });
        }
        return data;
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
            const data = await service.fetchData(); 
            this.fullData = data;
            this.currentPage = 1;
            this.currentSearchTerm = '';
            this.renderCurrentPage();

        } catch (e) {
            console.error('Error al cargar datos de localidad:', e);
            tableContentWrapper.innerHTML = `<p class="error-message">Error al cargar la tabla ${linkText}: ${e.message}</p>`;
        }
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

    renderCurrentPage() {
        const tableName = this.currentTable;
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

        if (!isTableDrawn || (dataSlice.length === 0 && this.currentSearchTerm)) {
            this.renderTableContent(tableName, dataSlice, true, config.headers, totalRecords, totalPages);
            this.enableCrudListeners(tableName);
        } else {
            this._updateTableBodyOnly(dataSlice, true, startIndex);
        }

        this.setupSearchAndFilterListeners();
    }

    renderRow(row, tableName, isCrudTable, indexOffset) {
        const config = REPORT_CONFIG[tableName];
        const rowId = row[config.id_key];
        const rowNumber = indexOffset + 1;

        const isVisible = row['visible'] !== false;
        const rowClass = isVisible === false ? 'inactive-record' : '';
        const deleteTitle = isVisible === false ? 'Registro Eliminado' : 'Eliminar';
        const deleteDisabled = isVisible === false ? 'disabled' : '';

        let rowCells = `
            <td>${row.nombre ?? ''}</td>
            <td>${row.municipio?.nombre ?? 'N/A'}</td> 
        `;

        return `
            <tr data-id="${rowId}" class="${rowClass}">
                <td>${rowNumber}</td>
                ${rowCells}
                ${isCrudTable ? `
                    <td>
                        <button class="btn-action btn-edit" data-id="${rowId}" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-action btn-delete" data-id="${rowId}" title="${deleteTitle}" ${deleteDisabled}>
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                ` : ''}
            </tr>
        `;
    }

    renderTableContent(tableName, dataSlice, isCrudTable, headers, totalRecords, totalPages) {
        const recordText = 'registros';
        const currentDataLength = dataSlice.length;

        const displayHeaders = headers.filter(h => h.toUpperCase() !== 'VISIBLE');

        const recordCountSpan = this.displayElement.querySelector('.record-count');
        if (recordCountSpan) {
            recordCountSpan.textContent = `Total: ${totalRecords} ${recordText} (${currentDataLength} en esta página)`;
        }

        const tableContentWrapper = this.displayElement.querySelector('#table-content-wrapper');

        if (!dataSlice || dataSlice.length === 0) {
            tableContentWrapper.innerHTML = `<p class="info-message">No se encontraron ${recordText} en la tabla ${this.currentLinkText}.</p>`;
            return;
        }


        let tableHTML = `
            <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        ${displayHeaders.map(header => `<th>${header.toUpperCase()}</th>`).join('')}
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
        const searchInstructions = 'Busca por Nombre de Localidad o Municipio';
        return `
            <div class="filter-controls-container">
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
        const searchInput = this.displayElement.querySelector('#table-search-input');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const newTerm = searchInput.value;

                if (this.currentSearchTerm === newTerm) return;

                this.currentSearchTerm = newTerm;

                clearTimeout(this.searchTimeout);

                if (this.currentSearchTerm.trim() === '') {
                    this.currentPage = 1;
                    this.renderCurrentPage();
                    return;
                }

                this.searchTimeout = setTimeout(() => {
                    this.currentPage = 1;
                    this.renderCurrentPage();
                }, 300);
            });
        }
    }

    async showForm(tableName, action, id = null) {
        const configForm = CRUD_FIELDS_CONFIG[tableName];
        const service = SERVICE_MAP[tableName];

        if (!configForm || !service) {
            alert(`Error: Configuración o Servicio no encontrado para la tabla ${tableName}.`);
            return;
        }

        const titleText = action === 'create' ? 'Nueva Localidad' : 'Editar Localidad';

        this.modalTitle.textContent = titleText;
        this.modalBody.innerHTML = this.loadingHTML;

        let formData = {};
        let initialDepartamentoId = null;
        let initialMunicipioId = null;

        if (action === 'edit' && id) {
            try {
                formData = await service.getById(id);
                initialDepartamentoId = formData.id_departamento;
                initialMunicipioId = formData.id_municipio;
            } catch (e) {
                this.modalBody.innerHTML = `<p class="error-message">Error al cargar datos del ID ${id}. ${e.message}</p>`;
                return;
            }
        }

        let departamentoOptions = [];
        let municipioOptions = [];
        try {
            departamentoOptions = await SERVICE_MAP['departamento'].getSelectOptions();

            if (initialDepartamentoId) {
                municipioOptions = await SERVICE_MAP['municipio'].getSelectOptions(initialDepartamentoId);
            }

        } catch (e) {
            this.modalBody.innerHTML = `<p class="error-message">Error al cargar Departamentos o Municipios: ${e.message}</p>`;
            return;
        }


        const fieldsToRender = configForm.filter(field => 
            field.name !== 'visible' && 
            field.name !== 'id_localidad' && 
            field.name !== 'nombre_municipio'
        );

        let formFieldsHTML = fieldsToRender.map(field => {
            let currentValue = formData[field.name] ?? '';
            const requiredAttr = field.required ? 'required' : '';
            const placeholderText = field.placeholder || `Ingrese ${field.label.toLowerCase()}`;
            const disabledAttrBase = field.disabled ? 'disabled' : '';

            if (field.type === 'select') {
                let options = [];
                let selectPlaceholder = field.placeholder;
                let isDisabled = disabledAttrBase || (field.name === 'id_municipio' && !initialDepartamentoId && action === 'create' ? 'disabled' : '');

                if (field.name === 'id_departamento') {
                    options = departamentoOptions;
                    currentValue = initialDepartamentoId; 
                } else if (field.name === 'id_municipio') {
                    options = municipioOptions;
                    currentValue = initialMunicipioId; 
                    if (!initialDepartamentoId) selectPlaceholder = 'Seleccione un departamento primero';
                } else {
                    options = field.options || [];
                }

                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}:</label>
                        <select class="input-select" id="${field.name}" name="${field.name}" ${requiredAttr} ${isDisabled}>
                            <option value="" disabled ${!currentValue ? 'selected' : ''}>${selectPlaceholder}</option>
                            ${options.map(option => `
                                <option value="${option.value}" ${String(currentValue) === String(option.value) ? 'selected' : ''}>
                                    ${option.text}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `;
            }

            return `
                <div class="form-group">
                    <label for="${field.name}">${field.label}:</label>
                    <input type="${field.type}" class="input-text" id="${field.name}" name="${field.name}" value="${currentValue}" ${requiredAttr} placeholder="${placeholderText}" ${disabledAttrBase}>
                </div>
            `;
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

        const departamentoSelect = document.getElementById('id_departamento');
        const municipioSelect = document.getElementById('id_municipio');

        if (departamentoSelect && municipioSelect) {
            departamentoSelect.addEventListener('change', async (e) => {
                const selectedDeptId = e.target.value;
                municipioSelect.innerHTML = '<option value="" disabled selected>Cargando municipios...</option>';
                municipioSelect.disabled = true;

                if (selectedDeptId) {
                    try {
                        const options = await SERVICE_MAP['municipio'].getSelectOptions(selectedDeptId);
                        municipioSelect.innerHTML = '<option value="" disabled selected>Seleccione un municipio</option>' +
                            options.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('');
                        municipioSelect.disabled = false;
                    } catch (error) {
                        console.error('Error al cargar municipios:', error);
                        municipioSelect.innerHTML = '<option value="" disabled selected>Error al cargar municipios</option>';
                    }
                } else {
                    municipioSelect.innerHTML = '<option value="" disabled selected>Seleccione un departamento primero</option>';
                    municipioSelect.disabled = true;
                }
            });
        }

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
        const service = SERVICE_MAP[tableName];

        if (!service) return;

        const nombre = form.elements['nombre']?.value.trim();
        const id_municipio = form.elements['id_municipio']?.value;

        if (!nombre || !id_municipio) {
            alert('El nombre de la localidad y el municipio son obligatorios.'); return;
        }

        const payload = {
            nombre: nombre,
            id_municipio: parseInt(id_municipio),
            visible: true 
        };

        try {
            if (action === 'create') {
                await service.create(payload);
                alert(`Localidad creada con éxito!`);
            } else {
                await service.update(id, payload);
                alert(`Localidad actualizada con éxito!`);
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
        if (!service || !service.softDelete) return;

        try {
            await service.softDelete(id);
            alert(`La localidad fue eliminada con éxito.`);
            this.loadTable();
        } catch (e) {
            console.error('Error al eliminar registro:', e);
            alert(`No se pudo eliminar la localidad: ${e.message}`);
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

                if (confirm(`¿Está seguro de eliminar esta Localidad?`)) {
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