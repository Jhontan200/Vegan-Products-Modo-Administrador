// CategoriaService.js - CÓDIGO CORREGIDO

import { supabase } from '../supabaseClient.js';
import { REPORT_CONFIG } from '../config/tableConfigs.js';

const TABLE_NAME = 'categoria';
// Asegúrate de que REPORT_CONFIG[TABLE_NAME] exista y contenga id_key
const CONFIG = REPORT_CONFIG[TABLE_NAME] || { id_key: 'id', select: '*' };

export const CategoriaService = {
    /**
     * Obtiene solo los registros VISIBLES (visible = true) para el panel de administración.
     */
    async fetchData() {
        let query = supabase.from(TABLE_NAME)
            .select(CONFIG.select)
            // FILTRO: Solo visible = true para la vista del administrador
            .eq('visible', true)
            .order('id', { ascending: true });

        const { data, error } = await query;

        if (error) {
            console.error('Error al obtener datos de categoría:', error);
            throw new Error(`Error en el servicio: ${error.message}`);
        }
        return data;
    },

    /**
     * Obtiene un registro por su ID para edición.
     */
    async getById(id) {
        const { data, error } = await supabase.from(TABLE_NAME)
            .select('*')
            .eq(CONFIG.id_key, id)
            .single();

        if (error) {
            console.error('Error al obtener categoría por ID:', error);
            throw new Error(`Categoría ID ${id} no encontrada: ${error.message}`);
        }
        return data;
    },

    /**
     * Crea un nuevo registro.
     * ✅ CORREGIDO: Espera 'payload' (objeto simple) en lugar de 'formData'.
     */
    async create(payload) {
        // Acceder a la propiedad del objeto con notación de punto, NO con .get()
        const nombre = payload.nombre;
        const visible = payload.visible; // Esto ya debería ser 'true' desde AdminCategoryManager.js

        const { error } = await supabase.from(TABLE_NAME)
            .insert([{ nombre, visible }]);

        if (error) {
            console.error('Error al crear categoría:', error);
            throw new Error(`No se pudo crear la categoría: ${error.message}`);
        }
    },

    /**
     * Actualiza un registro existente.
     * ✅ CORREGIDO: Espera 'payload' (objeto simple) en lugar de 'formData'.
     */
    async update(id, payload) {
        // Acceder a la propiedad del objeto con notación de punto, NO con .get()
        const nombre = payload.nombre;
        const visible = payload.visible;

        // Actualizamos ambos campos, nombre y visible (que siempre es true al editar desde el form)
        const { error } = await supabase.from(TABLE_NAME)
            .update({ nombre: nombre, visible: visible })
            .eq(CONFIG.id_key, id);

        if (error) {
            console.error('Error al actualizar categoría:', error);
            throw new Error(`No se pudo actualizar la categoría ID ${id}: ${error.message}`);
        }
    },

    /**
     * Implementa la 'soft delete' (inhabilitación) invirtiendo el campo 'visible'.
     */
    async softDelete(id) {
        // ... (Este método no necesita cambios ya que no usa formData)

        const current = await this.getById(id);
        // Invierte el estado de visibilidad actual
        const newVisibleState = !current.visible;

        const { error } = await supabase.from(TABLE_NAME)
            .update({ visible: newVisibleState })
            .eq(CONFIG.id_key, id);

        if (error) {
            console.error('Error al cambiar visibilidad:', error);
            throw new Error(`Error al cambiar la visibilidad de la categoría ID ${id}: ${error.message}`);
        }
        return newVisibleState;
    },

    /**
     * Función requerida para el SELECT del formulario de Producto,
     * solo incluye categorías VISIBLES y ordenadas por ID ascendente.
     */
    async getSelectOptions() {
        const { data, error } = await supabase.from(TABLE_NAME)
            .select('id, nombre')
            .eq('visible', true)
            .order('id', { ascending: true });

        if (error) {
            console.error('Error en CategoriaService.getSelectOptions:', error);
            throw new Error(`Error al cargar las categorías: ${error.message}`);
        }

        return data.map(item => ({
            value: item.id,
            text: item.nombre
        }));
    },
};