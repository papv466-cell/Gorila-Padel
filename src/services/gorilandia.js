import { supabase } from './supabaseClient';
import { notifySocialLike, notifySocialComment } from './notifications';

// ============================================
// FEED
// ============================================

export async function getFeed(limit = 20, offset = 0) {
  const { data: posts, error } = await supabase
    .from('gorilandia_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', userIds);

  let usersMap = {};
  if (users && users.length > 0) {
    usersMap = Object.fromEntries(users.map(u => [u.id, u]));
  }

  const enrichedPosts = posts.map(post => ({
    ...post,
    user: usersMap[post.user_id] || { 
      id: post.user_id, 
      email: 'Usuario', 
      full_name: 'Usuario' 
    }
  }));

  return enrichedPosts;
}

// ============================================
// POSTS
// ============================================

export async function createPost(type, mediaUrls, caption = '', clubId = null, matchId = null, taggedUsers = []) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('gorilandia_posts')
    .insert({
      user_id: user.id,
      type,
      media_url: mediaUrls,
      caption,
      club_id: clubId,
      match_id: matchId,
      tagged_users: taggedUsers || []
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePost(postId) {
  const { error } = await supabase
    .from('gorilandia_posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
}

// ============================================
// REACCIONES
// ============================================

export async function toggleReaction(postId, reactionType = 'gorila') {
  console.log('🎯 toggleReaction - postId:', postId, 'type:', reactionType);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  
  console.log('👤 Usuario:', user.id);

  // Buscar si YA existe esta reacción específica (no cualquier reacción)
  const { data: existing } = await supabase
    .from('gorilandia_reactions')
    .select('id, reaction_type')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .eq('reaction_type', reactionType)
    .maybeSingle();

  console.log('🔎 Reacción existente:', existing);

  if (existing) {
    // Si ya existe, la quitamos (toggle off)
    const result = await supabase
      .from('gorilandia_reactions')
      .delete()
      .eq('id', existing.id);
    console.log('🗑️ Reacción eliminada:', result);
    return { action: 'removed' };
  } else {
    // Si no existe, la añadimos
    const result = await supabase
      .from('gorilandia_reactions')
      .insert({ 
        post_id: postId, 
        user_id: user.id, 
        reaction_type: reactionType 
      });
      console.log('➕ Reacción creada:', result);

      console.log('🔔 [1] EMPEZANDO bloque de notificación');
      
      // NOTIFICACIÓN: Enviar al dueño del post
      try {
        console.log('🔔 [2] Dentro del TRY');
        
        // Obtener el post para saber quién es el dueño
        const { data: post } = await supabase
          .from('gorilandia_posts')
          .select('user_id')
          .eq('id', postId)
          .single();
      
        console.log('🔔 [3] Post obtenido:', post);
      
        // Solo notificar si NO es tu propio post
        if (post && post.user_id !== user.id) {
          console.log('🔔 [4] NO es mi propio post, obteniendo perfil...');
          
          // Obtener nombre del que dio like
          const { data: likerProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single();
      
          console.log('🔔 [5] Perfil obtenido:', likerProfile);
          console.log('🔔 [6] Llamando a notifySocialLike...');
      
          await notifySocialLike({
            postId,
            likerName: likerProfile?.full_name || likerProfile?.email || 'Alguien',
            userId: post.user_id
          });
          
          console.log('🔔 [7] ✅ Notificación enviada!');
        } else {
          console.log('🔔 [4] Es mi propio post, NO notificar');
        }
      } catch (notifError) {
        console.error('🔔 [ERROR] Error sending like notification:', notifError);
      }

    // NOTIFICACIÓN: Enviar al dueño del post
    try {
      // Obtener el post para saber quién es el dueño
      const { data: post } = await supabase
        .from('gorilandia_posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      // Solo notificar si NO es tu propio post
      if (post && post.user_id !== user.id) {
        // Obtener nombre del que dio like
        const { data: likerProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();

        await notifySocialLike({
          postId,
          likerName: likerProfile?.full_name || likerProfile?.email || 'Alguien',
          userId: post.user_id
        });
      }
    } catch (notifError) {
      console.error('Error sending like notification:', notifError);
    }

    return { action: 'added', type: reactionType };
  }
}

export async function getPostReactions(postId) {
  console.log('🔍 Buscando reacciones para post:', postId);
  
  const { data, error } = await supabase
    .from('gorilandia_reactions')
    .select('reaction_type, user_id')
    .eq('post_id', postId);

  console.log('📦 Datos recibidos:', data);
  console.log('❌ Error:', error);

  if (error) throw error;

  const grouped = { gorila: 0, fuego: 0, fuerza: 0, risa: 0 };
  data.forEach(r => { 
    console.log('➕ Sumando reacción:', r.reaction_type);
    if (grouped[r.reaction_type] !== undefined) grouped[r.reaction_type]++;
  });
  
  console.log('✅ Total agrupado:', grouped);
  return grouped;
}

export async function getUserReaction(postId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('gorilandia_reactions')
    .select('reaction_type')
    .eq('post_id', postId)
    .eq('user_id', user.id);

  // Devolver array de tipos de reacción ['gorila', 'fuego']
  return data ? data.map(r => r.reaction_type) : [];
}

// ============================================
// COMENTARIOS
// ============================================

export async function getComments(postId) {
  const { data: comments, error } = await supabase
    .from('gorilandia_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!comments || comments.length === 0) return [];

  const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', userIds);

  let usersMap = {};
  if (users && users.length > 0) {
    usersMap = Object.fromEntries(users.map(u => [u.id, u]));
  }

  return comments.map(comment => ({
    ...comment,
    user: usersMap[comment.user_id] || {
      id: comment.user_id,
      email: 'Usuario',
      full_name: 'Usuario'
    }
  }));
}

export async function createComment(postId, text) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('gorilandia_comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      text: text.trim()
    })
    .select()
    .single();

  if (error) throw error;

  // NOTIFICACIÓN: Enviar al dueño del post
  try {
    // Obtener el post para saber quién es el dueño
    const { data: post } = await supabase
      .from('gorilandia_posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    // Solo notificar si NO es tu propio post
    if (post && post.user_id !== user.id) {
      // Obtener nombre del comentarista
      const { data: commenterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      await notifySocialComment({
        postId,
        commenterName: commenterProfile?.full_name || commenterProfile?.email || 'Alguien',
        comment: text.trim(),
        userId: post.user_id
      });
    }
  } catch (notifError) {
    console.error('Error sending comment notification:', notifError);
  }

  return data;
}

export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('gorilandia_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

// ============================================
// STORAGE
// ============================================

export async function uploadMedia(file, type = 'image') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('gorilandia')
    .upload(fileName, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('gorilandia')
    .getPublicUrl(fileName);

  return publicUrl;
}