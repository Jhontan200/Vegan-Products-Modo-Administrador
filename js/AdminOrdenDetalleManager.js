import { REPORT_CONFIG } from './config/tableConfigs.js'; 
import { OrdenDetalleService } from './services/OrdenDetalleService.js';
import { OrdenService } from './services/OrdenService.js';
import { ProductoService } from './services/ProductoService.js'; 

const SERVICE_MAP = {
    'orden_detalle': OrdenDetalleService,
    'orden': OrdenService,
    'producto': ProductoService,
};

const TABLES_ALLOWING_CREATE = []; 
const TABLE_NAME = 'orden_detalle';
const MODAL_ID = 'crud-modal';

export class AdminOrdenDetalleManager {

    constructor(displayElementId, modalId = MODAL_ID) {
        this.displayElement = document.getElementById(displayElementId);
        this.modal = document.getElementById(modalId);
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');
        
        this.currentTable = TABLE_NAME;
        this.currentLinkText = 'Detalles de Orden'; 

        this.fullData = []; 
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentSearchTerm = '';
        
        this.loadingHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Cargando datos...</div>';
        this.searchTimeout = null; 

        this.allProducts = []; 
        this.currentOrderDetails = [];
        this.currentOrdenId = null; 

        this.setupModalListeners();
    }

    setupModalListeners() {
        document.getElementById('close-modal-btn')?.addEventListener('click', () => {
            this.modal.classList.remove('active');
        });
    }
    
    _getSafeImageUrl(urlString) {
        const SUPABASE_PLACEHOLDER_URL = 'https://tu-dominio.supabase.co/storage/v1/object/public/images/placeholder.png'; 
        
        const stringValue = String(urlString || '');

        if (stringValue.startsWith('http')) {
            return stringValue;
        } 
        
        return SUPABASE_PLACEHOLDER_URL; 
    }
    
    filterData() {
        let data = this.fullData;
        const term = this.currentSearchTerm.toLowerCase().trim();
        
        if (term) {
            return data.filter(row => {
                const id_orden = String(row.id_orden || '').toLowerCase();
                return id_orden.includes(term); 
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
                <span class="record-count">Cargando...</span>
            </div>
            ${this._renderSearchBox()}
            <div id="table-content-wrapper">
                ${this.loadingHTML}
            </div>
        `;

        this.setupSearchAndFilterListeners();
        const detalleService = SERVICE_MAP[tableName];
        const ordenService = SERVICE_MAP['orden'];
        const tableContentWrapper = this.displayElement.querySelector('#table-content-wrapper');

        if (!detalleService || !ordenService) {
            tableContentWrapper.innerHTML = `<p class="error-message">Error: Servicios de Orden y Detalle no encontrados.</p>`;
            return;
        }

        try {
            
            const allOrders = await ordenService.fetchData(); 

            const rawDetails = await detalleService.fetchData(); 

            const aggregatedDetailsMap = rawDetails.reduce((acc, detalle) => {
                const ordenId = detalle.id_orden;
                
                if (!acc[ordenId]) {
                    acc[ordenId] = { total_productos: 0 };
                }
                
                if (detalle.visible !== false) {
                    acc[ordenId].total_productos += (detalle.cantidad || 0);
                }
                
                return acc;
            }, {});

            this.fullData = allOrders.map(orden => {
                const aggregated = aggregatedDetailsMap[orden.id] || { total_productos: 0 };
                return {
                    id_orden: orden.id,
                    total_productos: aggregated.total_productos,
                    visible: orden.visible 
                };
            });
            
            this.currentPage = 1;
            this.currentSearchTerm = ''; 
            this.renderCurrentPage();

        } catch (e) {
            tableContentWrapper.innerHTML = `<p class="error-message">Error al cargar la tabla ${linkText}: ${e.message}</p>`;
        }
    }

    renderCurrentPage() {
        const filteredData = this.filterData();
        const totalRecords = filteredData.length;
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const dataSlice = filteredData.slice(startIndex, endIndex);
        
        
        const displayHeaders = ['N° ORDEN', 'PRODUCTOS (Total Cantidad)'];

        this.renderTableContent(dataSlice, displayHeaders, totalRecords, totalPages);

        this.enableTableListeners(); 
    }
    
    renderRow(row, indexOffset) { 
        const ordenId = row.id_orden; 
        
        const isVisible = row.visible !== false; 
        const rowClass = isVisible === false ? 'inactive-record' : '';
        
        return `
            <tr data-id="${ordenId}" class="${rowClass}">
                <td>${ordenId}</td>
                <td>${row.total_productos} unidades</td>
                <td class="actions-cell">
                    <button class="btn-action btn-edit" data-id="${ordenId}" title="Gestionar Productos (Carrito)">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete-details btn-delete-red" data-id="${ordenId}" title="Eliminar todos los productos activos y resetear Total a $0.00">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    renderTableContent(dataSlice, headers, totalRecords, totalPages) {
        const recordText = 'órdenes';
        const currentDataLength = dataSlice.length;
        
        const recordCountSpan = this.displayElement.querySelector('.record-count');
        if (recordCountSpan) {
             recordCountSpan.textContent = `Total: ${totalRecords} ${recordText} (${currentDataLength} en esta página)`;
        }
        
        const tableContentWrapper = this.displayElement.querySelector('#table-content-wrapper');

        if (!dataSlice || dataSlice.length === 0) {
            tableContentWrapper.innerHTML = `<p class="info-message">No se encontraron ${recordText} que contengan productos.</p>`;
            return;
        }

        let tableHTML = `
            <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header.toUpperCase()}</th>`).join('')}
                        <th>ACCIONES</th>
                    </tr>
                </thead>
                <tbody>
                    ${dataSlice.map((row, index) => this.renderRow(row, (this.currentPage - 1) * this.itemsPerPage + index)).join('')}
                </tbody>
            </table>
            </div>
            ${this._renderPaginationControls(totalPages)}
        `;

        tableContentWrapper.innerHTML = tableHTML;
    }
    
    _renderSearchBox() {
        const searchInstructions = 'Busca por N° de Orden';
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
    
    enableTableListeners() {
        this.displayElement.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', (e) => {
                const ordenId = parseInt(e.currentTarget.getAttribute('data-id'));
                this.showOrderDetailsForm(ordenId); 
            });
        });
        
        this.displayElement.querySelectorAll('.btn-delete-details').forEach(button => {
            button.addEventListener('click', (e) => {
                const ordenId = parseInt(e.currentTarget.getAttribute('data-id'));
                this.handleClearOrderDetailsFromTable(ordenId);
            });
        });
        
        this.setupPaginationListeners();
    }
    
    async handleClearOrderDetailsFromTable(ordenId) {
        if (!confirm(`¿Está seguro de eliminar TODOS los productos de la Orden N° ${ordenId}? Esto también reseteará el Total a $0.00.`)) return;

        try {
            const detailsToClear = (await SERVICE_MAP['orden_detalle'].fetchByOrdenId(ordenId))
                                    .filter(det => det.visible !== false);
            
            await this._clearAllDetailsAndResetTotal(ordenId, detailsToClear);
            
            alert(`Todos los productos de la Orden N° ${ordenId} fueron eliminados y el Total se reseteó a $0.00.`);
            this.loadTable(); 
        } catch (e) {
            alert(`Error al limpiar la orden: ${e.message}`);
        }
    }

    async showOrderDetailsForm(ordenId) {
        this.currentOrdenId = ordenId;
        this.modalTitle.textContent = `Gestión de Productos para la Orden N° ${ordenId}`;
        this.modalBody.innerHTML = this.loadingHTML;
        this.modal.classList.add('active');

        try {
            this.allProducts = await SERVICE_MAP['producto'].fetchData();
            
            await this.recalculateAndRedrawDetails(ordenId); 

            this.modalBody.innerHTML = this._renderOrderDetailsManager(ordenId);

            this.setupDetailListeners(ordenId);

        } catch (e) {
            this.modalBody.innerHTML = `<p class="error-message">Error al cargar los productos de la orden. Por favor, intente de nuevo.</p>`;
        }
    }

    _renderOrderDetailsManager(ordenId) {
        const totalOrden = this.currentOrderDetails
            .filter(det => det.visible !== false)
            .reduce((acc, det) => acc + ((det.cantidad || 0) * (det.precio_unitario || 0)), 0);
        
        const productsOptions = this.allProducts
            .filter(p => p.visible !== false) 
            .map(p => {
                const rawPrice = p.precio_unitario || p.precio || 0; 
                const precio = parseFloat(rawPrice).toFixed(2);
                
                return `<option 
                    value="${p.id}" 
                    data-precio="${rawPrice || 0}"
                    data-image="${p.imagen_url || ''}" 
                >
                    ${p.nombre} ($${precio}) 
                </option>`;
            }).join('');

        return `
            <div class="details-manager-container" data-orden-id="${ordenId}">
                <h3>Añadir Producto</h3>
                
                <div class="add-detail-controls card">
                    <div class="form-group">
                        <label for="select-producto">Producto:</label>
                        <select id="select-producto" class="input-select select-buscador" required>
                            <option value="">Seleccione un Producto (Buscar por nombre)</option>
                            ${productsOptions}
                        </select>
                    </div>
                    
                    <div id="product-info-display" class="product-info-display">
                        <img id="product-image" src="" alt="Imagen del producto" style="display:none; width: 50px; height: 50px; object-fit: cover; margin-right: 10px; border-radius: 5px;">
                        <span id="product-price-display"></span>
                    </div>

                    <div class="form-group-inline">
                        <div class="form-group">
                            <label for="input-cantidad">Cantidad:</label>
                            <input type="number" id="input-cantidad" class="input-text-small" placeholder="Cantidad" min="1" value="1" required>
                        </div>
                        <div class="form-group">
                            <label for="input-precio-unitario">Precio Unitario (Fijo):</label>
                            <input type="text" id="input-precio-unitario" class="input-text-small" readonly placeholder="Precio" required>
                        </div>
                    </div>
                    <button type="button" id="btn-add-detail" class="btn-primary-modal btn-full-width">
                        <i class="fas fa-cart-plus"></i> Añadir Producto
                    </button>
                </div>
                
                <div class="details-header-actions">
                    <h3>Productos Actuales</h3>
                    </div>

                <div class="table-responsive">
                    <table class="data-table details-table" id="order-details-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cant.</th>
                                <th>P. Unitario</th>
                                <th>Subtotal</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="details-table-body">
                            ${this._renderDetailsTableBody()}
                        </tbody>
                    </table>
                </div>

                <div class="order-total-display">
                    <strong>Total de la Orden:</strong> 
                    <span id="order-total-amount">$${new Intl.NumberFormat('es-CO').format(totalOrden.toFixed(2))}</span>
                </div>
            </div>
        `;
    }

    _renderDetailsTableBody() {
        const activeDetails = this.currentOrderDetails.filter(detalle => detalle.visible !== false);
        
        
        if (activeDetails.length === 0) {
            return '<tr><td colspan="5" class="info-message">No hay productos activos en esta orden.</td></tr>';
        }

        return activeDetails.map(detalle => {
            const nombreProducto = detalle.nombre || (detalle.p ? detalle.p.nombre : 'Producto Desconocido'); 
            
            const cantidad = detalle.cantidad || 0;
            const precioUnitario = detalle.precio_unitario || 0;
            
            const subtotal = cantidad * precioUnitario;
            
            return `
                <tr data-detalle-id="${detalle.id}">
                    <td>
                        ${nombreProducto}
                    </td>
                    <td>
                        <input type="number" class="input-text-tiny detail-cantidad" data-detalle-id="${detalle.id}" value="${cantidad}" min="1">
                    </td>
                    <td>
                        <input type="text" class="input-text-tiny detail-precio-unitario" value="${parseFloat(precioUnitario).toFixed(2)}" readonly>
                    </td>
                    <td><span class="detail-subtotal">$${new Intl.NumberFormat('es-CO').format(subtotal.toFixed(2))}</span></td>
                    <td class="actions-cell">
                        <button type="button" class="btn-action btn-update-detail" data-id="${detalle.id}" title="Guardar Cambios"><i class="fas fa-save"></i></button>
                        <button type="button" class="btn-action btn-remove-detail" data-id="${detalle.id}" title="Eliminar Producto"><i class="fas fa-times"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    setupDetailListeners(ordenId) {
        
        const selectProducto = document.getElementById('select-producto');
        const inputPrecioUnitario = document.getElementById('input-precio-unitario');
        const productImage = document.getElementById('product-image');
        const productPriceDisplay = document.getElementById('product-price-display');

        selectProducto?.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const precio = selectedOption.getAttribute('data-precio');
            const imageUrl = selectedOption.getAttribute('data-image'); 
            
            if (precio && parseFloat(precio) >= 0) {
                inputPrecioUnitario.value = parseFloat(precio).toFixed(2);
                
                const fullImageUrl = this._getSafeImageUrl(imageUrl);
                                 
                productImage.src = fullImageUrl;
                productImage.style.display = 'inline-block';
                productPriceDisplay.textContent = `P. Unitario: $${parseFloat(precio).toFixed(2)}`;
            } else {
                inputPrecioUnitario.value = '';
                productImage.style.display = 'none';
                productPriceDisplay.textContent = '';
            }
        });

        const btnAddDetail = document.getElementById('btn-add-detail');
        if (btnAddDetail) {
            const newBtnAddDetail = btnAddDetail.cloneNode(true);
            btnAddDetail.parentNode.replaceChild(newBtnAddDetail, btnAddDetail);
            
            newBtnAddDetail.addEventListener('click', () => {
                this.handleAddDetail(ordenId);
            });
        }
        
        this.modalBody.querySelectorAll('.btn-update-detail').forEach(button => {
            button.addEventListener('click', (e) => {
                const detalleId = e.currentTarget.getAttribute('data-id');
                this.handleUpdateDetail(detalleId);
            });
        });

        this.modalBody.querySelectorAll('.btn-remove-detail').forEach(button => {
            button.addEventListener('click', (e) => {
                const detalleId = e.currentTarget.getAttribute('data-id');
                this.handleDeleteDetail(ordenId, detalleId);
            }
            );
        });

        this.modalBody.querySelectorAll('.detail-cantidad').forEach(input => {
            input.addEventListener('input', (e) => {
                this.updateLocalSubtotal(e.target.closest('tr'));
            });
        });
    }

    async handleAddDetail(ordenId) {
        const id_producto = document.getElementById('select-producto').value;
        const cantidad = document.getElementById('input-cantidad').value;
        const precio_unitario = document.getElementById('input-precio-unitario').value; 

        if (!id_producto || !cantidad || !precio_unitario || parseInt(cantidad) <= 0 || parseFloat(precio_unitario) <= 0) {
            alert('Por favor, seleccione un producto, ingrese una cantidad y un precio válidos.');
            return;
        }
        
        const formData = new FormData();
        formData.append('id_orden', ordenId);
        formData.append('id_producto', id_producto);
        formData.append('cantidad', cantidad); 
        formData.append('precio_unitario', precio_unitario);
        formData.append('visible', true); 

        
        try {
            await SERVICE_MAP['orden_detalle'].create(formData);
            alert('El producto fue añadido correctamente a la orden.');
            await this.recalculateAndRedrawDetails(ordenId); 
        } catch (e) {
            alert(`Error al añadir el producto: ${e.message}`);
        }
    }


    async handleUpdateDetail(detalleId) {
        const row = this.modalBody.querySelector(`tr[data-detalle-id="${detalleId}"]`);
        const cantidad = row.querySelector('.detail-cantidad').value;
        const precio_unitario = row.querySelector('.detail-precio-unitario').value; 

        if (parseInt(cantidad) <= 0) {
            alert('La cantidad debe ser mayor a cero.');
            return;
        }
        
        const detalleIdInt = parseInt(detalleId);
        const detailToUpdate = this.currentOrderDetails.find(d => d.id === detalleIdInt);
        
        if (!detailToUpdate || !detailToUpdate.id_producto) {
            alert('Error interno: No se pudo obtener la información del producto para la actualización.');
            return;
        }
        const id_producto = detailToUpdate.id_producto;


        const formData = new FormData();
        formData.append('cantidad', cantidad);
        formData.append('precio_unitario', precio_unitario); 
        formData.append('id_producto', id_producto); 
        

        try {
            await SERVICE_MAP['orden_detalle'].update(detalleId, formData);
            alert('La cantidad del producto se actualizó y el total de la orden fue recalculado.');
            const ordenId = row.closest('.details-manager-container').getAttribute('data-orden-id');
            await this.recalculateAndRedrawDetails(ordenId); 
        } catch (e) {
            alert(`Error al actualizar la cantidad: ${e.message}`);
        }
    }

    async handleDeleteDetail(ordenId, detalleId) {
        if (!confirm('¿Está seguro de ELIMINAR este producto de la orden? El total de la orden se actualizará.')) return;
        
        try {
            await SERVICE_MAP['orden_detalle'].toggleVisibility(detalleId, false);
            alert('Producto eliminado de la orden. El Total de la orden fue actualizado.');
            await this.recalculateAndRedrawDetails(ordenId); 
        } catch (e) {
            alert(`Error al eliminar el producto: ${e.message}`);
        }
    }
    
    async _clearAllDetailsAndResetTotal(ordenId, detailsToClear) {
        
        if (!detailsToClear || detailsToClear.length === 0) {
            await SERVICE_MAP['orden'].updateTotal(ordenId, '0.00'); 
            return;
        }

        const detailPromises = detailsToClear.map(det => 
            SERVICE_MAP['orden_detalle'].toggleVisibility(det.id, false)
        );
        await Promise.all(detailPromises);
        
        await SERVICE_MAP['orden'].updateTotal(ordenId, '0.00'); 
    }

    async recalculateAndRedrawDetails(ordenId) {
        try {
            this.currentOrderDetails = await SERVICE_MAP['orden_detalle'].fetchByOrdenId(ordenId);

            const newTotal = this.currentOrderDetails
                .filter(det => det.visible !== false) 
                .reduce((acc, det) => acc + ((det.cantidad || 0) * (det.precio_unitario || 0)), 0);
            
            await SERVICE_MAP['orden'].updateTotal(ordenId, newTotal.toFixed(2)); 

            const detailsBody = this.modalBody.querySelector('#details-table-body');
            const totalAmountSpan = this.modalBody.querySelector('#order-total-amount');

            if (detailsBody) {
                detailsBody.innerHTML = this._renderDetailsTableBody();
            }
            if (totalAmountSpan) {
                totalAmountSpan.textContent = `$${new Intl.NumberFormat('es-CO').format(newTotal.toFixed(2))}`;
            }
            
            this.setupDetailListeners(ordenId);
        } catch (e) {
            alert(`Error al recalcular el total de la orden: ${e.message}`);
        }
    }
    
    updateLocalSubtotal(rowElement) {
        const cantidad = parseFloat(rowElement.querySelector('.detail-cantidad').value) || 0;
        const precio_unitario = parseFloat(rowElement.querySelector('.detail-precio-unitario').value) || 0;
        const subtotal = cantidad * precio_unitario;
        rowElement.querySelector('.detail-subtotal').textContent = `$${new Intl.NumberFormat('es-CO').format(subtotal.toFixed(2))}`;
    }

    setupSearchAndFilterListeners() {
        const searchInput = this.displayElement.querySelector('#table-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.currentSearchTerm = searchInput.value;
                clearTimeout(this.searchTimeout); 
                this.searchTimeout = setTimeout(() => {
                    this.currentPage = 1; 
                    this.renderCurrentPage();
                }, 300); 
            });
        }
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