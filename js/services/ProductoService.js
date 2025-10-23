import { supabase } from '../supabaseClient.js';
import { REPORT_CONFIG } from '../config/tableConfigs.js';

const TABLE_NAME = 'producto';
const CONFIG = REPORT_CONFIG[TABLE_NAME];

async function uploadProductImage(file) {
    if (!file || typeof file.size === 'undefined' || file.size === 0) {
        return null;
    }
    
    const originalFileName = file.name || ''; 
    const fileExtension = originalFileName.split('.').pop(); 
    
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('productos')
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

export const ProductoService = {

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

    async create(formData) {
        const file = formData.get('file_upload');
        const dataToInsert = Object.fromEntries(formData.entries());

        try {
            dataToInsert.imagen_url = await uploadProductImage(file);
        } catch (e) {
            throw e;
        }

        delete dataToInsert.file_upload;

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

    async getProductDetails(id) {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('id, nombre, precio')
            .eq('id', id)
            .single();

        if (error) {
            console.error('[Supabase Error - getProductDetails]', error);
            throw new Error(`Error al obtener detalles del producto ID ${id}: ${error.message}`);
        }
        return data;
    },

    async update(id, formData) {
        const file = formData.get('file_upload');
        const currentImageUrl = formData.get('imagen_url');
        const dataToUpdate = Object.fromEntries(formData.entries());

        try {
            if (file && file.size > 0) {
                dataToUpdate.imagen_url = await uploadProductImage(file);
            } else {
                dataToUpdate.imagen_url = currentImageUrl || null;
            }
        } catch (e) {
            throw e;
        }

        delete dataToUpdate.file_upload;
        dataToUpdate.precio = parseFloat(dataToUpdate.precio);
        dataToUpdate.stock = parseInt(dataToUpdate.stock);
        dataToUpdate.id_categoria = parseInt(dataToUpdate.id_categoria);

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
        return data.map(item => ({ value: item.id, text: item.nombre }));
    }
};