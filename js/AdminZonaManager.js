import { REPORT_CONFIG, CRUD_FIELDS_CONFIG } from './config/tableConfigs.js';
import { ZonaService } from './services/ZonaService.js';
import { LocalidadService } from './services/LocalidadService.js';
import { MunicipioService } from './services/MunicipioService.js';
import { DepartamentoService } from './services/DepartamentoService.js';

const SERVICE_MAP = {
    'zona': ZonaService,
    'localidad': LocalidadService,
    'municipio': MunicipioService,
    'departamento': DepartamentoService,
};

export class AdminZonaManager {

    constructor(displayElementId, modalId = 'crud-modal') {
        this.displayElement = document.getElementById(displayElementId);
        this.modal = document.getElementById(modalId);
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');

        this.currentTable = 'zona';
        this.currentLinkText = 'Zonas';

        this.fullData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentSearchTerm = '';

        this.loadingHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Cargando datos...</div>';

        this.searchTimeout = null;

        this.initialDepartamentoId = null;
        this.initialMunicipioId = null;
        this.initialLocalidadId = null;
        
        this.crudListenersInitialized = false; 

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
                const nombreZona = String(row.nombre || '').toLowerCase();
                const nombreLocalidad = String(row.l?.nombre || '').toLowerCase();

                return nombreZona.includes(term) || nombreLocalidad.includes(term);
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
            tableContentWrapper.innerHTML = `<p class="error-message">Error al cargar la tabla ${linkText}: ${e.message}</p>`;
        }
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
            <td>${row.l?.nombre ?? 'N/A'}</td> 
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

        this.setupPaginationListeners();
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

        if (!isTableDrawn || dataSlice.length === 0 && this.currentSearchTerm) {
            this.renderTableContent(tableName, dataSlice, true, config.headers, totalRecords, totalPages);
        } else {
            this._updateTableBodyOnly(dataSlice, true, startIndex);
        }

        this.enableCrudListeners(tableName);
        this.setupSearchAndFilterListeners();
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
                        <th>N°</th>
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
        const searchInstructions = 'Busca por Nombre de Zona o Localidad';
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

        const titleText = action === 'create' ? 'Nueva Zona' : 'Editar Zona';

        this.modalTitle.textContent = titleText;
        this.modalBody.innerHTML = this.loadingHTML;

        let formData = {};
        this.initialDepartamentoId = null;
        this.initialMunicipioId = null;
        this.initialLocalidadId = null;

        if (action === 'edit' && id) {
            try {
                formData = await service.getById(id);
                this.initialLocalidadId = formData.id_localidad;

                const localidadData = await SERVICE_MAP['localidad'].getById(this.initialLocalidadId);
                this.initialMunicipioId = localidadData.id_municipio;

                const municipioData = await SERVICE_MAP['municipio'].getById(this.initialMunicipioId);
                this.initialDepartamentoId = municipioData.id_departamento;

                formData['id_departamento'] = this.initialDepartamentoId;
                formData['id_municipio'] = this.initialMunicipioId;

            } catch (e) {
                this.modalBody.innerHTML = `<p class="error-message">Error al cargar datos del ID ${id}. ${e.message}</p>`;
                return;
            }
        }

        let departamentoOptions = [];
        let municipioOptions = [];
        let localidadOptions = [];
        try {
            departamentoOptions = await SERVICE_MAP['departamento'].getSelectOptions();

        } catch (e) {
            this.modalBody.innerHTML = `<p class="error-message">Error al cargar datos de cascada: ${e.message}</p>`;
            return;
        }

        const fieldsToRender = configForm.filter(field => field.name !== 'visible' && field.name !== 'id_zona');

        let formFieldsHTML = fieldsToRender.map(field => {
            let currentValue = formData[field.name] ?? '';
            const requiredAttr = field.required ? 'required' : '';
            const placeholderText = field.placeholder || `Ingrese ${field.label.toLowerCase()}`;
            let disabledAttrBase = field.disabled ? 'disabled' : '';

            if (field.type === 'select') {
                let options = [];
                let selectPlaceholder = field.placeholder;
                let isDisabled = disabledAttrBase;

                if (field.name === 'id_departamento') {
                    options = departamentoOptions;
                } else if (field.name === 'id_municipio') {
                    options = municipioOptions;
                    isDisabled = disabledAttrBase || (action === 'edit' ? 'disabled' : (!this.initialDepartamentoId && action === 'create' ? 'disabled' : ''));
                    selectPlaceholder = action === 'edit' ? 'Cargando municipios...' : 'Seleccione un departamento primero';

                } else if (field.name === 'id_localidad') {
                    options = localidadOptions;
                    isDisabled = disabledAttrBase || (action === 'edit' ? 'disabled' : (!this.initialMunicipioId && action === 'create' ? 'disabled' : ''));
                    selectPlaceholder = action === 'edit' ? 'Cargando localidades...' : 'Seleccione un municipio primero';
                }

                const selectedValue = currentValue;

                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}:</label>
                        <select class="input-select" id="${field.name}" name="${field.name}" ${requiredAttr} ${isDisabled}>
                            <option value="" disabled ${!selectedValue ? 'selected' : ''}>${selectPlaceholder}</option>
                            ${options.map(option => `
                                <option value="${option.value}" ${String(selectedValue) === String(option.value) ? 'selected' : ''}>
                                    ${option.text}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `;
            }

            const nombreDisabledAttr = action === 'create' && field.name === 'nombre' ? 'disabled' : disabledAttrBase;
            return `
                <div class="form-group">
                    <label for="${field.name}">${field.label}:</label>
                    <input type="${field.type}" class="input-text" id="${field.name}" name="${field.name}" value="${currentValue}" ${requiredAttr} placeholder="${placeholderText}" ${nombreDisabledAttr}>
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
        const localidadSelect = document.getElementById('id_localidad');
        const nombreInput = document.getElementById('nombre');
        const self = this;

        const loadLocalidades = async (selectedMuniId) => {
            localidadSelect.innerHTML = '<option value="" disabled selected>Cargando localidades...</option>';
            localidadSelect.disabled = true;
            if (nombreInput && action === 'create') nombreInput.disabled = true;


            if (selectedMuniId) {
                try {
                    const options = await SERVICE_MAP['localidad'].getSelectOptions(selectedMuniId);
                    const selectedLocalidadId = self.initialLocalidadId;

                    localidadSelect.innerHTML = '<option value="" disabled selected>Seleccione una localidad</option>' +
                        options.map(opt => `<option value="${opt.value}" ${String(selectedLocalidadId) === String(opt.value) ? 'selected' : ''}>${opt.text}</option>`).join('');
                    localidadSelect.disabled = false;

                    self.initialLocalidadId = null;

                    if (localidadSelect.value && nombreInput && action === 'create') {
                        nombreInput.disabled = false;
                    } 

                } catch (error) {
                    localidadSelect.innerHTML = '<option value="" disabled selected>Error al cargar localidades</option>';
                }
            } else {
                localidadSelect.innerHTML = '<option value="" disabled selected>Seleccione un municipio primero</option>';
            }
        };

        const loadMunicipios = async (selectedDeptId) => {
            municipioSelect.innerHTML = '<option value="" disabled selected>Cargando municipios...</option>';
            municipioSelect.disabled = true;
            localidadSelect.innerHTML = '<option value="" disabled selected>Seleccione un municipio primero</option>';
            localidadSelect.disabled = true;
            if (nombreInput && action === 'create') nombreInput.disabled = true;

            if (selectedDeptId) {
                try {
                    const options = await SERVICE_MAP['municipio'].getSelectOptions(selectedDeptId);
                    const selectedMuniId = self.initialMunicipioId;
                    
                    municipioSelect.innerHTML = '<option value="" disabled selected>Seleccione un municipio</option>' +
                        options.map(opt => `<option value="${opt.value}" ${String(selectedMuniId) === String(opt.value) ? 'selected' : ''}>${opt.text}</option>`).join('');
                    municipioSelect.disabled = false;

                    if (selectedMuniId) {
                        await loadLocalidades(selectedMuniId);
                    } else {
                        localidadSelect.innerHTML = '<option value="" disabled selected>Seleccione un municipio primero</option>';
                        localidadSelect.disabled = true;
                    }
                    self.initialMunicipioId = null;
                } catch (error) {
                    municipioSelect.innerHTML = '<option value="" disabled selected>Error al cargar municipios</option>';
                }
            } else {
                municipioSelect.innerHTML = '<option value="" disabled selected>Seleccione un departamento primero</option>';
            }
        };

        departamentoSelect.addEventListener('change', (e) => {
            loadMunicipios(e.target.value);
        });
        municipioSelect.addEventListener('change', (e) => {
            self.initialLocalidadId = null;
            loadLocalidades(e.target.value);
        });

        if (action === 'edit' && this.initialDepartamentoId) {
            loadMunicipios(this.initialDepartamentoId);
        }

        localidadSelect.addEventListener('change', (e) => {
            if (action === 'create') {
                if (e.target.value && nombreInput) {
                    nombreInput.disabled = false;
                } else if (nombreInput) {
                    nombreInput.disabled = true;
                }
            }
        });


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
        const id_localidad = form.elements['id_localidad']?.value;

        if (!nombre || !id_localidad) {
            alert('El nombre de la zona y la localidad son obligatorios.'); return;
        }

        const payload = {
            nombre: nombre,
            id_localidad: parseInt(id_localidad),
        };
        
        try {
            if (action === 'create') {
                await service.create(payload);
                alert(`Zona creada con éxito!`);
            } else {
                await service.update(id, payload);
                alert(`Zona actualizada con éxito!`);
            }

            this.modal.classList.remove('active');
            this.loadTable();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    }

    async toggleVisibility(id, isVisible) {
        if (isVisible === false) return;

        const service = SERVICE_MAP[this.currentTable];
        if (!service || !service.softDelete) return;

        try {
            await service.softDelete(id);
            alert(`✅ Zona eliminada correctamente.`); 
            this.loadTable();
        } catch (e) {
            alert(`❌ No se pudo eliminar la zona: ${e.message}`);
        }
    }

    enableCrudListeners(tableName) {
        if (this.crudListenersInitialized) {
            this.setupPaginationListeners();
            return;
        }

        const self = this;
        this.displayElement.addEventListener('click', function(e) {
            const target = e.target.closest('.btn-action, .btn-create');

            if (!target) return;

            e.preventDefault();

            if (target.classList.contains('btn-create')) {
                self.showForm(tableName, 'create');
            } else if (target.classList.contains('btn-edit')) {
                const id = target.getAttribute('data-id');
                self.showForm(tableName, 'edit', id); 
            } else if (target.classList.contains('btn-delete')) {
                const id = target.getAttribute('data-id');
                const rowData = self.fullData.find(d => String(d[REPORT_CONFIG[tableName].id_key]) === id);
                const isVisible = rowData?.visible !== false;

                if (!isVisible) return;

                if (confirm(`¿Está seguro de eliminar esta Zona?`)) {
                    self.toggleVisibility(id, isVisible);
                }
            }
        });

        this.crudListenersInitialized = true;
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