import { supabase } from '../supabaseClient.js';
import { REPORT_CONFIG } from '../config/tableConfigs.js';

const TABLE_NAME = 'localidad';
const ID_KEY = 'id_localidad';
// Incluimos el nombre del municipio en la selección
const CONFIG = REPORT_CONFIG[TABLE_NAME] || {
    id_key: ID_KEY,
    select: 'id_localidad, nombre, visible, municipio:id_municipio!inner(nombre)'
};

export const LocalidadService = {
    /**
     * Obtiene solo los registros VISIBLES, incluyendo el nombre del municipio (JOIN).
     */
    async fetchData() {
        let query = supabase.from(TABLE_NAME)
            .select(CONFIG.select)
            .eq('visible', true)
            .order(ID_KEY, { ascending: true });

        const { data, error } = await query;

        if (error) {
            console.error('Error al obtener datos de localidad:', error);
            throw new Error(`Error en el servicio de Localidad: ${error.message}`);
        }
        return data;
    },

    /**
     * Obtiene un registro por su ID para edición, extrayendo el ID del Departamento (padre del municipio).
     */
    async getById(id) {
        const { data, error } = await supabase.from(TABLE_NAME)
            // Selecciona todos los campos de localidad (*) y hace un INNER JOIN al municipio para obtener el id_departamento
            .select(`*, municipio!inner(id_departamento)`)
            .eq(ID_KEY, id)
            .single();

        if (error) {
            console.error('Error al obtener localidad por ID:', error);
            throw new Error(`Localidad ID ${id} no encontrada: ${error.message}`);
        }

        // Aplana el objeto para que el Manager pueda acceder directamente a id_departamento
        return {
            ...data,
            id_departamento: data.municipio.id_departamento // Extrae el ID del departamento del JOIN
        };
    },

    /**
     * Crea un nuevo registro a partir del payload (objeto simple).
     */
    async create(payload) {
        // payload contiene: { nombre, id_municipio, visible }
        const { error } = await supabase.from(TABLE_NAME)
            .insert([{ ...payload, visible: true }]); // Aseguramos que visible sea true

        if (error) {
            console.error('Error al crear localidad:', error);
            // Manejo de errores específico para violación de unicidad
            if (error.code === '23505') {
                throw new Error(`Ya existe una localidad con el nombre "${payload.nombre}" en el municipio seleccionado.`);
            }
            throw new Error(`No se pudo crear la localidad: ${error.message}`);
        }
    },

    /**
     * Actualiza un registro existente a partir del payload (objeto simple).
     */
    async update(id, payload) {
        // payload contiene: { nombre, id_municipio }
        const { error } = await supabase.from(TABLE_NAME)
            .update(payload)
            .eq(ID_KEY, id);

        if (error) {
            console.error('Error al actualizar localidad:', error);
            throw new Error(`No se pudo actualizar la localidad ID ${id}: ${error.message}`);
        }
    },

    /**
     * Implementa la 'soft delete' (inhabilitación) invirtiendo el campo 'visible'.
     */
    async softDelete(id) {
        const current = await this.getById(id);
        // La llamada a getById trae datos con la estructura aplanada, el campo 'visible' se mantiene.
        const newVisibleState = !current.visible;

        const { error } = await supabase.from(TABLE_NAME)
            .update({ visible: newVisibleState })
            .eq(ID_KEY, id);

        if (error) {
            console.error('Error al cambiar visibilidad:', error);
            throw new Error(`Error al cambiar la visibilidad de la localidad ID ${id}: ${error.message}`);
        }
        return newVisibleState;
    },

    /**
     * Función para SELECT options. Permite filtrar por Municipio.
     */
    async getSelectOptions(municipioId = null) {
        let query = supabase.from(TABLE_NAME)
            .select(`${ID_KEY}, nombre`)
            .eq('visible', true)
            .order('nombre', { ascending: true });

        if (municipioId) {
            query = query.eq('id_municipio', municipioId);
        }

        const { data, error } = await query;

        if (error) {
            console.error(`Error en ${TABLE_NAME}.getSelectOptions:`, error);
            throw new Error(`Error al cargar las localidades: ${error.message}`);
        }

        return data.map(item => ({
            value: item[ID_KEY],
            text: item.nombre
        }));
    },
};