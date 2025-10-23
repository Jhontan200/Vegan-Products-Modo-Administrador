// js/services/ProductoService.js

import { supabase } from '../supabaseClient.js';
import { REPORT_CONFIG } from '../config/tableConfigs.js';

const TABLE_NAME = 'producto';
const CONFIG = REPORT_CONFIG[TABLE_NAME];

/**
 * Lógica para manejar la subida de la imagen a Supabase Storage.
 * @param {File} file - Archivo de imagen a subir.
 * @returns {Promise<string|null>} La URL pública de la imagen o null si hay error.
 */
async function uploadProductImage(file) {
    // CORRECCIÓN 1: Validar que 'file' es un objeto File con un tamaño > 0
    if (!file || typeof file.size === 'undefined' || file.size === 0) {
        return null;
    }
    
    // CORRECCIÓN 2: Sintaxis corregida y manejo seguro del nombre del archivo
    // Usamos el nombre del archivo si existe, sino, usamos una cadena vacía para evitar errores.
    const originalFileName = file.name || ''; 
    const fileExtension = originalFileName.split('.').pop(); 
    
    // Generación de un nombre único
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('productos') // Nombre del bucket de Supabase Storage
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error('Error al subir la imagen:', uploadError);
        throw new Error(`Error al subir la imagen: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
        .from('productos')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

// =========================================================================
// MÉTODOS PÚBLICOS DEL SERVICIO
// =========================================================================

export const ProductoService = {

    /**
     * Consulta y devuelve todos los productos visibles para el reporte.
     */
    async fetchData() {
        let query = supabase.from(TABLE_NAME)
            .select(CONFIG.select)
            .eq('visible', true)
            .order(CONFIG.id_key, { ascending: true });

        const { data, error } = await query;

        if (error) {
            console.error('Error en ProductoService.fetchData:', error);
            throw new Error(`Error al cargar productos: ${error.message}`);
        }
        return data;
    },

    /**
     * Inserta un nuevo producto, subiendo la imagen si existe.
     */
    async create(formData) {
        const file = formData.get('file_upload');
        const dataToInsert = Object.fromEntries(formData.entries());

        try {
            dataToInsert.imagen_url = await uploadProductImage(file);
        } catch (e) {
            throw e; // Propagar error de subida
        }

        // Limpiar campos que no van a la base de datos
        delete dataToInsert.file_upload;

        // Formatear datos (números, visibles)
        dataToInsert.precio = parseFloat(dataToInsert.precio);
        dataToInsert.stock = parseInt(dataToInsert.stock);
        dataToInsert.id_categoria = parseInt(dataToInsert.id_categoria);
        dataToInsert.visible = true;

        const { error } = await supabase.from(TABLE_NAME).insert(dataToInsert);

        if (error) {
            console.error('Error en ProductoService.create:', error);
            throw new Error(`Error al crear producto: ${error.message}`);
        }
        return true;
    },

    /**
     * Obtiene los datos de un producto por ID (usado para cargar el formulario de edición).
     */
    async getById(id) {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq(CONFIG.id_key, id)
            .single();

        if (error) {
            console.error('Error en ProductoService.getById:', error);
            throw new Error(`Error al obtener producto ID ${id}: ${error.message}`);
        }
        return data;
    },

    /**
     * 🟢 NUEVO MÉTODO CRÍTICO: Obtiene solo el ID, Nombre y PRECIO.
     * Usado por AdminOrdenManager para poblar el campo precio_unitario.
     */
    async getProductDetails(id) {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('id, nombre, precio') // Solo necesitamos el precio
            .eq('id', id)
            .single();

        if (error) {
            console.error('[Supabase Error - getProductDetails]', error);
            throw new Error(`Error al obtener detalles del producto ID ${id}: ${error.message}`);
        }
        return data; // Retorna { id: 1, nombre: 'Producto X', precio: 10.50 }
    },


    /**
     * Actualiza un producto existente, maneja la subida de una nueva imagen o mantiene la actual.
     */
    async update(id, formData) {
        const file = formData.get('file_upload');
        const currentImageUrl = formData.get('imagen_url');
        const dataToUpdate = Object.fromEntries(formData.entries());

        // 1. Manejo de imagen
        try {
            if (file && file.size > 0) {
                // Subir nueva imagen
                dataToUpdate.imagen_url = await uploadProductImage(file);
            } else {
                // Mantener imagen existente (del campo hidden 'imagen_url')
                dataToUpdate.imagen_url = currentImageUrl || null;
            }
        } catch (e) {
            throw e; // Propagar error de subida
        }

        // 2. Limpieza y Formato
        delete dataToUpdate.file_upload;
        dataToUpdate.precio = parseFloat(dataToUpdate.precio);
        dataToUpdate.stock = parseInt(dataToUpdate.stock);
        dataToUpdate.id_categoria = parseInt(dataToUpdate.id_categoria);

        // El campo 'visible' se asume que no se edita aquí, se hace con softDelete.

        // 3. Actualización en Supabase
        const { error } = await supabase
            .from(TABLE_NAME)
            .update(dataToUpdate)
            .eq(CONFIG.id_key, id);

        if (error) {
            console.error('Error en ProductoService.update:', error);
            throw new Error(`Error al actualizar producto: ${error.message}`);
        }
        return true;
    },

    /**
     * Realiza un "Soft Delete" (visible = false) para inhabilitar el producto.
     */
    async softDelete(id) {
        const { error } = await supabase
            .from(TABLE_NAME)
            .update({ visible: false })
            .eq(CONFIG.id_key, id);

        if (error) {
            console.error('Error en ProductoService.softDelete:', error);
            throw new Error(`Error al inhabilitar producto: ${error.message}`);
        }
        return true;
    },

    /**
     * 🟢 NUEVO MÉTODO: Devuelve una lista de productos en formato {value: id, text: nombre} para los <select>.
     */
    async getSelectOptions() {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('id, nombre')
            .eq('visible', true)
            .order('nombre', { ascending: true });

        if (error) {
            console.error('Error en ProductoService.getSelectOptions:', error);
            throw new Error(`Error al cargar opciones de productos: ${error.message}`);
        }
        // Mapeamos a un formato universal para los selects
        return data.map(item => ({ value: item.id, text: item.nombre }));
    }
};