// Configuración para la VISTA DE TABLA (JOINs y Encabezados)
export const REPORT_CONFIG = {
    'producto': {
        // ... (sin cambios)
        select: 'id, nombre, imagen_url, descripcion, precio, stock, c:categoria!id_categoria(nombre)',
        id_key: 'id',
        headers: ['N°', 'Nombre de Producto', 'Imagen', 'Descripción', 'Precio Unitario', 'Stock Actual', 'Categoría']
    },
    'categoria': {
        // Seleccionamos todos los campos que tiene la tabla
        select: 'id, nombre, visible',
        id_key: 'id',
        headers: ['N°', 'Nombre de Categoría', 'Visible'],
        // No es necesario 'softDelete' ya que usaremos el campo 'visible'
    },
    'usuario': {
        id_key: 'id',
        // 🛑 CAMBIO: Seleccionamos todos los nombres y apellidos para unirlos después.
        // También incluimos 'visible' para el soft delete.
        select: 'id, ci, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno, rol, correo_electronico, contrasena, visible',
        // 🛑 CAMBIO: Reducimos los encabezados a los campos unidos.
        headers: ['ID', 'CI', 'NOMBRE COMPLETO', 'APELLIDO COMPLETO', 'ROL', 'CORREO ELECTRÓNICO', 'CONTRASEÑA', 'VISIBLE'],
    },
    'direccion': {

        id_key: 'id_direccion',

        // ✅ CORRECCIÓN CLAVE: El SELECT se compacta en una sola línea y se eliminan espacios
        // para evitar errores de codificación en el GET.
        // El select para localidad debe ir anidado en zona: z:zona!id_zona(nombre,localidad!id_localidad(nombre))
        select: `id_direccion,calle_avenida,numero_casa_edificio,referencia_adicional,visible,u:usuario!id_usuario(primer_nombre,segundo_nombre,apellido_paterno,apellido_materno),z:zona!id_zona(nombre,l:localidad!id_localidad(nombre))`.replace(/\s/g, ''),
        // Encabezados de la tabla con "CLIENTE"
        headers: [
            'N°',
            'CLIENTE',
            'LOCALIDAD',
            'CALLE/AVENIDA',
            'N° CASA/EDIFICIO',
            'REFERENCIA ADICIONAL',
            'ZONA',
        ],
    },
    'orden': {
        id_key: 'id',
        // ✅ CORRECCIÓN CLAVE: Se eliminan todos los comentarios '//'
        // La estructura de anidación es correcta, solo necesitaba la limpieza.
        select: `id,fecha,total,metodo_pago,estado,visible,
                u:usuario!id_usuario(primer_nombre,segundo_nombre,apellido_paterno,apellido_materno),
                d:direccion!id_direccion(
                    calle_avenida,
                    numero_casa_edificio,
                    referencia_adicional,
                    z:zona!id_zona(
                        nombre,
                        l:localidad!id_localidad(
                            nombre,
                            m:municipio!id_municipio(
                                nombre,
                                dep:departamento!id_departamento(nombre)
                            )
                        )
                    )
                )`.replace(/\s/g, ''),

        // 🛑 CAMBIO CLAVE: Encabezados Actualizados para reflejar el detalle de la Dirección
        headers: [
            'N°',
            'CLIENTE',
            'FECHA',
            'TOTAL',
            'MÉTODO PAGO',
            'DIRECCIÓN COMPLETA',
            'ESTADO',
        ],
    },
    'orden_detalle': {
        id_key: 'id',
        // SELECT con JOIN a Producto para mostrar el nombre
        select: `id,id_orden,cantidad,precio_unitario,visible,p:producto!id_producto(nombre)`.replace(/\s/g, ''),
        headers: [
            'ID DETALLE',
            'N° ORDEN', // Corresponde al N°(id_orden) solicitado
            'PRODUCTO', // Obtenido del JOIN
            'CANTIDAD', // Corresponde a la cantidad solicitada
            'PRECIO UNITARIO',
            'VISIBLE'
        ],
    },
    'departamento': {
        select: 'id_departamento, nombre, visible',
        id_key: 'id_departamento',
        headers: ['N°', 'Nombre de Departamento', 'Visible'],
    },
    'municipio': {
        id_key: 'id_municipio',
        // ✅ CORRECCIÓN CLAVE: Se añade el SELECT con el JOIN al nombre del departamento.
        select: 'id_municipio,nombre,id_departamento,visible,departamento!inner(nombre)'.replace(/\s/g, ''),
        // Los headers mostrarán el nombre del municipio y el nombre del departamento
        headers: ['N°', 'MUNICIPIO', 'DEPARTAMENTO', 'VISIBLE'],
    },
    'localidad': {
        id_key: 'id_localidad',
        headers: ['N°', 'LOCALIDAD', 'MUNICIPIO'],
        // Seleccionamos la localidad y el nombre del municipio (INNER JOIN)
        select: 'id_localidad, nombre, visible, municipio:id_municipio!inner(nombre)'
    },
    'zona': {
        id_key: 'id_zona',
        // La clave 'select' une la tabla 'zona' con 'localidad' para obtener solo el nombre de la localidad.
        // Usamos el alias 'l:localidad' y luego solo el campo '(nombre)'.
        select: 'id_zona, nombre, visible, l:localidad!inner(nombre)',
        // Los encabezados deseados: N°, Zona (Nombre), Localidad (Nombre)
        // 'N°' y 'ACCIONES' se añaden automáticamente por el Manager, solo listamos las columnas de datos.
        headers: ['NOMBRE DE ZONA', 'LOCALIDAD', 'VISIBLE'],
    },
};


// Configuración para el MODAL DE CRUD (Campos del Formulario)
export const CRUD_FIELDS_CONFIG = {
    'producto': [
        { name: 'nombre', label: 'Nombre del Producto', type: 'text', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea', required: false },
        { name: 'precio', label: 'Precio Unitario (Bs.)', type: 'number', step: '0.01', required: true },
        { name: 'stock', label: 'Stock Actual', type: 'number', required: true },
        { name: 'file_upload', label: 'Subir Imagen (Max 2MB)', type: 'file', required: false },
        // 🛑 CAMBIO CLAVE: Cambiamos 'type' a 'select'
        {
            name: 'id_categoria',
            label: 'Categoría',
            type: 'select',
            required: true,
            // 💡 NUEVA PROPIEDAD: Indica qué servicio usar para cargar opciones
            options_service: 'CategoriaService'
        },
        { name: 'imagen_url', label: 'Imagen URL', type: 'hidden' },
    ],
    'categoria': [
        { name: 'nombre', label: 'Nombre de la Categoría', type: 'text', required: true, maxLength: 50 },
        { name: 'visible', label: '¿Es Visible al Público?', type: 'checkbox', required: false },
    ],
    'usuario': [
        { name: 'id', label: 'ID (UUID)', type: 'hidden', disabled: true },
        { name: 'ci', label: 'Cédula de Identidad (CI)', type: 'text', required: true },
        { name: 'primer_nombre', label: 'Primer Nombre', type: 'text', required: true },
        { name: 'segundo_nombre', label: 'Segundo Nombre', type: 'text', required: false },
        { name: 'apellido_paterno', label: 'Apellido Paterno', type: 'text', required: true },
        { name: 'apellido_materno', label: 'Apellido Materno', type: 'text', required: true },
        { name: 'celular', label: 'Celular', type: 'text', required: true },
        { name: 'correo_electronico', label: 'Correo Electrónico', type: 'email', required: true },
        // La contraseña debe ser de tipo 'password' en el CRUD
        { name: 'contrasena', label: 'Contraseña', type: 'password', required: false, placeholder: 'Dejar vacío para mantener la actual' },
        { name: 'rol', label: 'Rol', type: 'text', disabled: true },
    ],
    'direccion': [
        { name: 'id_direccion', label: 'ID', type: 'hidden', disabled: true },
        {
            name: 'id_usuario',
            label: 'Usuario (Propietario)',
            type: 'select',
            required: true,
            options_service: 'UsuarioService'
        },
        {
            name: 'id_zona',
            label: 'Zona',
            type: 'select',
            required: true,
            options_service: 'ZonaService'
        },
        {
            name: 'id_localidad',
            label: 'Localidad',
            type: 'select',
            required: false,
            options_service: 'LocalidadService'
        },
        { name: 'calle_avenida', label: 'Calle/Avenida', type: 'text', required: true, maxLength: 150 },
        { name: 'numero_casa_edificio', label: 'N° Casa/Edificio', type: 'text', required: false, maxLength: 20 },
        { name: 'referencia_adicional', label: 'Referencia Adicional', type: 'textarea', required: false },
    ],
    // 🟢 CONFIGURACIÓN PARA EL FORMULARIO ORDEN
    'orden': [
        { name: 'id', label: 'ID', type: 'hidden', disabled: true },
        { name: 'fecha', label: 'Fecha de Creación', type: 'datetime-local', required: true, disabled: true },

        // Campo que se renderizará como input CI en el AdminManager para buscar id_usuario
        {
            name: 'id_usuario',
            label: 'Cédula de Identidad (Cliente)',
            type: 'select',
            required: true,
            is_client_ci: true
        },
        {
            name: 'id_direccion',
            label: 'Dirección de Entrega',
            type: 'select',
            required: true,
            options_service: 'DireccionService',
            dependency: 'id_localidad_form'
        },

        {
            name: 'metodo_pago',
            label: 'Método de Pago',
            type: 'select',
            required: true,
            is_enum: true,
            options: ['QR', 'EFECTIVO', 'TARJETA'],
        },
        {
            name: 'estado',
            label: 'Estado de la Orden',
            type: 'select',
            required: true,
            is_enum: true,
            // 🛑 CORREGIDO a los 3 estados solicitados
            options: ['PENDIENTE', 'ENTREGADO', 'CANCELADO'],
        },
        { name: 'observaciones', label: 'Observaciones', type: 'textarea', required: false },
        { name: 'visible', label: 'Visible', type: 'checkbox' },
        { name: 'total', label: 'Total', type: 'hidden', disabled: true }, // Campo oculto para el total
    ],
    'orden_detalle': [
        { name: 'id_producto', label: 'Producto', type: 'select', required: true, options_service: 'ProductoService' },
        { name: 'cantidad', label: 'Cantidad', type: 'number', required: true, min: '1' },
        { name: 'precio_unitario', label: 'Precio Unitario (Bs.)', type: 'number', step: '0.01', required: true, disabled: true },
    ],
    'departamento': [
        { name: 'nombre', label: 'Nombre del Departamento', type: 'text', required: true, maxLength: 50 },
        { name: 'visible', label: '¿Es Visible?', type: 'checkbox', required: false },
    ],
    'municipio': [
        { name: 'nombre', label: 'Nombre del Municipio', type: 'text', required: true, placeholder: 'Ejem: El Alto' },
        // Campo tipo 'select' para la llave foránea
        { name: 'id_departamento', label: 'Departamento', type: 'select', required: true, placeholder: 'Seleccione un Departamento' },
        { name: 'visible', label: 'Visible', type: 'checkbox', required: false, disabled: true },
    ],
    'localidad': [
        { name: 'id_localidad', label: 'ID Localidad', type: 'text', disabled: true },
        // **NUEVO:** Campo para el Departamento. No es parte de la tabla, pero es necesario para la cascada.
        {
            name: 'id_departamento',
            label: 'Departamento',
            type: 'select',
            required: true,
            placeholder: 'Seleccione un departamento',
            serviceName: 'departamento' // Usado por el Manager para saber qué servicio llamar
        },
        // Campo para el Municipio, será poblado después de seleccionar el departamento
        {
            name: 'id_municipio',
            label: 'Municipio',
            type: 'select',
            required: true,
            placeholder: 'Seleccione un municipio',
            serviceName: 'municipio', // Usado por el Manager para saber qué servicio llamar
            dependsOn: 'id_departamento' // Define la dependencia para la cascada
        },
        { name: 'nombre', label: 'Nombre de la Localidad', type: 'text', required: true, maxLength: 100 },
        { name: 'visible', label: 'Visible', type: 'checkbox', default: true, disabled: true }
    ],
    'zona': [
        // 1. Campo para la cascada: Departamento
        { name: 'id_departamento', label: 'Departamento', type: 'select', required: true, placeholder: 'Seleccione un departamento' },
        // 2. Campo para la cascada: Municipio
        { name: 'id_municipio', label: 'Municipio', type: 'select', required: true, placeholder: 'Seleccione un municipio' },
        // 3. Campo Clave (FK): Localidad
        {
            name: 'id_localidad',
            label: 'Localidad',
            type: 'select',
            required: true,
            placeholder: 'Seleccione la Localidad'
        },
        // 4. Campo de la tabla: Nombre de la Zona
        { name: 'nombre', label: 'Nombre de la Zona', type: 'text', required: true, placeholder: 'Ej: Zona Central' },
        // Campo oculto
        { name: 'visible', label: 'Visible', type: 'hidden', default: true, disabled: true }
    ],
};