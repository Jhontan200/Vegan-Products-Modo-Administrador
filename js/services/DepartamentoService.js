// DepartamentoService.js (CORREGIDO)

import { supabase } from '../supabaseClient.js';
import { REPORT_CONFIG } from '../config/tableConfigs.js';

const TABLE_NAME = 'departamento';
const ID_KEY = 'id_departamento';
const CONFIG = REPORT_CONFIG[TABLE_NAME] || { id_key: ID_KEY, select: 'id_departamento, nombre, visible' };

export const DepartamentoService = {
    /**
     * Obtiene solo los registros VISIBLES (visible = true) para el panel de administración.
     */
    async fetchData() {
        let query = supabase.from(TABLE_NAME)
            .select(CONFIG.select)
            // FILTRO: Solo visible = true
            .eq('visible', true)
            .order(ID_KEY, { ascending: true });

        const { data, error } = await query;

        if (error) {
            console.error('Error al obtener datos de departamento:', error);
            throw new Error(`Error en el servicio de Departamento: ${error.message}`);
        }
        return data;
    },

    /**
     * Obtiene un registro por su ID para edición.
     */
    async getById(id) {
        const { data, error } = await supabase.from(TABLE_NAME)
            .select('*')
            .eq(ID_KEY, id)
            .single();

        if (error) {
            console.error('Error al obtener departamento por ID:', error);
            throw new Error(`Departamento ID ${id} no encontrado: ${error.message}`);
        }
        return data;
    },

    /**
     * Crea un nuevo registro.
     * ✅ CORRECCIÓN: Espera un objeto 'payload' en lugar de 'formData'.
     * 🛑 CORRECCIÓN: Manejo de error por duplicidad (23505).
     */
    async create(payload) {
        const nombre = payload.nombre;
        const visible = true;

        const { error } = await supabase.from(TABLE_NAME)
            .insert([{ nombre, visible }]);

        if (error) {
            console.error('Error al crear departamento:', error);
            
            // Detección de error de duplicidad (código 23505) en la columna 'nombre'
            if (error.code === '23505') {
                throw new Error(`Ya existe un departamento con el nombre "${nombre}".`);
            }
            
            throw new Error(`No se pudo crear el departamento: ${error.message}`);
        }
    },

    /**
     * Actualiza un registro existente.
     * ✅ CORRECCIÓN: Espera un objeto 'payload' en lugar de 'formData'.
     * 🛑 CORRECCIÓN: Manejo de error por duplicidad (23505).
     */
    async update(id, payload) {
        const nombre = payload.nombre;
        // La visibilidad no suele cambiar en la edición del formulario, pero se puede incluir si payload la tiene.
        const updateData = { nombre: nombre };

        const { error } = await supabase.from(TABLE_NAME)
            .update(updateData)
            .eq(ID_KEY, id);

        if (error) {
            console.error('Error al actualizar departamento:', error);

            // Detección de error de duplicidad (código 23505)
            if (error.code === '23505') {
                throw new Error(`Ya existe otro departamento con el nombre "${nombre}".`);
            }
            
            throw new Error(`No se pudo actualizar el departamento ID ${id}: ${error.message}`);
        }
    },

    /**
     * Implementa la 'soft delete' (inhabilitación) invirtiendo el campo 'visible'.
     */
    async softDelete(id) {
        const current = await this.getById(id);
        // Invierte el estado de visibilidad actual
        const newVisibleState = !current.visible;

        const { error } = await supabase.from(TABLE_NAME)
            .update({ visible: newVisibleState })
            .eq(ID_KEY, id);

        if (error) {
            console.error('Error al cambiar visibilidad:', error);
            throw new Error(`Error al cambiar la visibilidad del departamento ID ${id}: ${error.message}`);
        }
        return newVisibleState;
    },

    /**
     * Función para SELECT options (solo VISIBLES).
     */
    async getSelectOptions() {
        const { data, error } = await supabase.from(TABLE_NAME)
            .select(`${ID_KEY}, nombre`)
            .eq('visible', true)
            .order(ID_KEY, { ascending: true });

        if (error) {
            console.error(`Error en ${TABLE_NAME}.getSelectOptions:`, error);
            throw new Error(`Error al cargar los departamentos: ${error.message}`);
        }

        return data.map(item => ({
            value: item[ID_KEY],
            text: item.nombre
        }));
    },
};