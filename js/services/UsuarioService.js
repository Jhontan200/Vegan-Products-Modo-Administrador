// Archivo: UsuarioService.js (AGREGADO getCiById)

import { supabase } from '../supabaseClient.js';
import { REPORT_CONFIG } from '../config/tableConfigs.js';

const TABLE_NAME = 'usuario';
// Importante: Asumiendo que CONFIG.id_key es 'id' (el UUID de Auth)
const CONFIG = REPORT_CONFIG[TABLE_NAME] || { id_key: 'id', select: 'id, primer_nombre' };

export const UsuarioService = {
    /**
     * Obtiene todos los usuarios visibles para la administración.
     */
    async fetchData() {
        let query = supabase.from(TABLE_NAME)
            .select(CONFIG.select)
            .eq('visible', true)
            .order('primer_nombre', { ascending: true });

        const { data, error } = await query;

        if (error) {
            console.error('Error al obtener datos de usuario:', error);
            throw new Error(`Error en el servicio de Usuario: ${error.message}`);
        }
        return data;
    },

    /**
     * Obtiene un registro por su ID (UUID) para edición.
     */
    async getById(id) {
        const { data, error } = await supabase.from(TABLE_NAME)
            .select('*')
            .eq(CONFIG.id_key, id)
            .single();

        if (error) {
            console.error('Error al obtener usuario por ID:', error);
            // Incluyo esta comprobación que faltaba para evitar errores en el flujo de la aplicación
            if (error.code === 'PGRST116') return null;
            throw new Error(`Usuario ID ${id} no encontrado: ${error.message}`);
        }
        return data;
    },

    
    async getCiById(uuid) {
        if (!uuid) return null;

        const { data, error } = await supabase.from(TABLE_NAME)
            .select('ci') // Solo necesitamos el campo 'ci'
            .eq(CONFIG.id_key, uuid)
            .single();

        // PGRST116 es el código de error de Supabase para 'No rows found' en .single()
        if (error && error.code !== 'PGRST116') {
            console.error('[UsuarioService - getCiById] Error fetching CI:', error);
            throw new Error(`Error al obtener CI: ${error.message}`);
        }

        // Retorna el valor del campo 'ci' si data existe, o null
        return data ? data.ci : null;
    },

   
    async getIdByCi(ci) {
        if (!ci) return null;

        const { data, error } = await supabase.from(TABLE_NAME)
            .select(CONFIG.id_key) // Selecciona la clave ID (el UUID)
            .eq('ci', ci.trim())
            .eq('visible', true) // Opcional: solo usuarios visibles
            .single();

        // PGRST116 es el código de error de Supabase para 'No rows found' en .single()
        if (error && error.code !== 'PGRST116') {
            console.error('Error al buscar usuario por CI:', error);
            throw new Error(`Error en la base de datos al buscar CI: ${error.message}`);
        }

        // Retorna el valor del campo ID_KEY si data existe, o null
        return data ? data[CONFIG.id_key] : null;
    },

   
    async create(formData) {
        const email = formData.get('correo_electronico');
        const password = formData.get('contrasena');
        const rol = formData.get('rol') || 'cliente';

        // 1. Prepara TODOS los datos del perfil para el Trigger (raw_user_meta_data)
        const userMetadata = {
            ci: formData.get('ci'),
            primer_nombre: formData.get('primer_nombre'),
            segundo_nombre: formData.get('segundo_nombre'),
            apellido_paterno: formData.get('apellido_paterno'),
            apellido_materno: formData.get('apellido_materno'),
            celular: formData.get('celular'),
            rol: rol,
            // La contraseña se envía aquí para que el perfil la almacene (si es necesario)
            contrasena: password,
            correo_electronico: email,
        };

        // 2. CREAR CUENTA EN SUPABASE AUTH
        // El Trigger se activará automáticamente después de esta línea para crear el perfil
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: userMetadata, // Pasamos todos los metadatos al Trigger
            }
        });

        // NOTA: Si el CI es duplicado, el Trigger fallará y este authError contendrá el error de la BD.

        if (authError) {
            console.error('Error de autenticación (signUp):', authError);
            throw new Error(`Fallo en el registro de autenticación: ${authError.message}`);
        }

        if (!authData.user) {
            throw new Error("El usuario se registró pero no se pudo obtener su ID. Revise la configuración de 'auto-confirm'.");
        }

        // El resto de la lógica de inserción del perfil (pasos 2 y 3) HA SIDO ELIMINADA.
    },

    /**
     * El método update se mantiene ya que la actualización no usa el mismo trigger
     * y las validaciones de duplicados en UPDATE se manejan de forma diferente.
     */
    async update(id, dataOrFormData) {
        let payload = {};
        let nuevaContrasena = null;
        let nuevoEmail = null;

        if (dataOrFormData instanceof FormData) {
            // Caso de edición completa
            payload = {
                ci: dataOrFormData.get('ci'),
                primer_nombre: dataOrFormData.get('primer_nombre'),
                segundo_nombre: dataOrFormData.get('segundo_nombre'),
                apellido_paterno: dataOrFormData.get('apellido_paterno'),
                apellido_materno: dataOrFormData.get('apellido_materno'),
                celular: dataOrFormData.get('celular'),
                rol: dataOrFormData.get('rol'),
                visible: dataOrFormData.has('visible') ?
                    dataOrFormData.get('visible') === 'on' :
                    undefined,
            };

            // Extraer campos de Auth
            nuevaContrasena = dataOrFormData.get('contrasena');
            nuevoEmail = dataOrFormData.get('correo_electronico');
            payload.correo_electronico = nuevoEmail;

        } else if (typeof dataOrFormData === 'object' && dataOrFormData !== null) {
            payload = dataOrFormData;
        } else {
            throw new Error("Formato de datos de actualización no soportado.");
        }

        // Limpiar el payload de valores nulos/undefined
        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

        // 1. Actualizar el usuario en Supabase Auth (contraseña y/o email - el email requiere admin client)
        if (nuevaContrasena) {
            const { error: authError } = await supabase.auth.admin.updateUserById(id, {
                password: nuevaContrasena,
            });
            if (authError) {
                console.error('Error al actualizar contraseña/auth:', authError);
                throw new Error(`No se pudo actualizar la contraseña en Auth: ${authError.message}`);
            }

            // 🛑 REQUERIDO POR EL USUARIO: Actualizar la columna 'contrasena' del perfil
            payload.contrasena = nuevaContrasena;
        }
        // NOTA: Si se actualiza el correo electrónico, se requiere lógica adicional para Auth o se confía en RLS.

        // 2. Actualizar el perfil en la tabla 'usuario'
        const { error } = await supabase.from(TABLE_NAME)
            .update(payload)
            .eq(CONFIG.id_key, id);

        if (error) {
            console.error('Error al actualizar perfil de usuario:', error);
            throw new Error(`No se pudo actualizar el usuario ID ${id}: ${error.message}`);
        }
    },
};