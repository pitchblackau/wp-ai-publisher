<?php
/**
 * Plugin Name: Pitch Black Publisher
 * Plugin URI:  https://pitchblack.au
 * Description: Secure REST API bridge for WP AI Publisher â€” manage posts, pages, media and site content remotely.
 * Version:     1.1.2
 * Author:      Pitch Black
 * License:     GPL-2.0-or-later
 * Update URI:  https://raw.githubusercontent.com/pitchblackau/wp-ai-publisher/master/plugin/update.json
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'PB_PUBLISHER_VERSION',    '1.1.2' );
define( 'PB_PUBLISHER_KEY_OPTION', 'pb_publisher_secret_key' );
define( 'PB_PUBLISHER_UPDATE_URL', 'https://raw.githubusercontent.com/pitchblackau/wp-ai-publisher/master/plugin/update.json' );

// â”€â”€â”€ Activation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

register_activation_hook( __FILE__, 'pb_publisher_activate' );
function pb_publisher_activate() {
    if ( ! get_option( PB_PUBLISHER_KEY_OPTION ) ) {
        update_option( PB_PUBLISHER_KEY_OPTION, wp_generate_password( 48, false ) );
    }
}

// â”€â”€â”€ Auth helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function pb_publisher_auth( WP_REST_Request $request ): bool {
    $stored = get_option( PB_PUBLISHER_KEY_OPTION );
    if ( ! $stored ) return false;
    $provided = $request->get_header( 'X-PB-Key' ) ?: $request->get_param( 'pb_key' );
    return $provided && hash_equals( $stored, $provided );
}

// â”€â”€â”€ REST API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

add_action( 'rest_api_init', 'pb_publisher_register_routes' );
function pb_publisher_register_routes(): void {
    $ns   = 'pb-publisher/v1';
    $auth = 'pb_publisher_auth';

    // Status
    register_rest_route( $ns, '/status', [ 'methods' => 'GET', 'callback' => 'pb_publisher_status', 'permission_callback' => $auth ] );

    // Posts
    register_rest_route( $ns, '/posts',         [ 'methods' => 'GET',    'callback' => 'pb_publisher_list_posts',   'permission_callback' => $auth ] );
    register_rest_route( $ns, '/posts',         [ 'methods' => 'POST',   'callback' => 'pb_publisher_create_post',  'permission_callback' => $auth ] );
    register_rest_route( $ns, '/posts/(?P<id>\d+)', [ 'methods' => 'GET',    'callback' => 'pb_publisher_get_post',    'permission_callback' => $auth ] );
    register_rest_route( $ns, '/posts/(?P<id>\d+)', [ 'methods' => 'PATCH',  'callback' => 'pb_publisher_update_post', 'permission_callback' => $auth ] );
    register_rest_route( $ns, '/posts/(?P<id>\d+)', [ 'methods' => 'DELETE', 'callback' => 'pb_publisher_delete_post', 'permission_callback' => $auth ] );

    // Pages
    register_rest_route( $ns, '/pages',         [ 'methods' => 'GET',    'callback' => 'pb_publisher_list_pages',   'permission_callback' => $auth ] );
    register_rest_route( $ns, '/pages',         [ 'methods' => 'POST',   'callback' => 'pb_publisher_create_page',  'permission_callback' => $auth ] );
    register_rest_route( $ns, '/pages/(?P<id>\d+)', [ 'methods' => 'PATCH',  'callback' => 'pb_publisher_update_page', 'permission_callback' => $auth ] );
    register_rest_route( $ns, '/pages/(?P<id>\d+)', [ 'methods' => 'DELETE', 'callback' => 'pb_publisher_delete_page', 'permission_callback' => $auth ] );

    // Media
    register_rest_route( $ns, '/media',         [ 'methods' => 'GET',    'callback' => 'pb_publisher_list_media',   'permission_callback' => $auth ] );
    register_rest_route( $ns, '/media',         [ 'methods' => 'POST',   'callback' => 'pb_publisher_upload_media', 'permission_callback' => $auth ] );
    register_rest_route( $ns, '/media/(?P<id>\d+)', [ 'methods' => 'DELETE', 'callback' => 'pb_publisher_delete_media', 'permission_callback' => $auth ] );

    // Options
    register_rest_route( $ns, '/options',       [ 'methods' => 'GET',    'callback' => 'pb_publisher_get_options',  'permission_callback' => $auth ] );
    register_rest_route( $ns, '/options',       [ 'methods' => 'PATCH',  'callback' => 'pb_publisher_set_options',  'permission_callback' => $auth ] );
}

// â”€â”€â”€ Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function pb_publisher_status(): WP_REST_Response {
    global $wp_version;
    return rest_ensure_response( [
        'ok'         => true,
        'site_name'  => get_bloginfo( 'name' ),
        'site_url'   => get_site_url(),
        'wp_version' => $wp_version,
        'pb_version' => PB_PUBLISHER_VERSION,
    ] );
}

// â”€â”€â”€ Posts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function pb_publisher_list_posts( WP_REST_Request $req ): WP_REST_Response {
    $args = [
        'post_type'      => 'post',
        'post_status'    => $req->get_param( 'status' ) ?: 'any',
        'posts_per_page' => min( (int) ( $req->get_param( 'per_page' ) ?: 20 ), 100 ),
        'paged'          => max( 1, (int) ( $req->get_param( 'page' ) ?: 1 ) ),
    ];
    $posts = get_posts( $args );
    return rest_ensure_response( array_map( 'pb_publisher_format_post', $posts ) );
}

function pb_publisher_get_post( WP_REST_Request $req ) {
    $post = get_post( (int) $req->get_param( 'id' ) );
    if ( ! $post || $post->post_type !== 'post' ) {
        return new WP_Error( 'not_found', 'Post not found', [ 'status' => 404 ] );
    }
    return rest_ensure_response( pb_publisher_format_post( $post ) );
}

function pb_publisher_create_post( WP_REST_Request $req ) {
    return pb_publisher_insert_or_update_post( 0, $req->get_json_params(), 'post' );
}

function pb_publisher_update_post( WP_REST_Request $req ) {
    return pb_publisher_insert_or_update_post( (int) $req->get_param( 'id' ), $req->get_json_params(), 'post' );
}

function pb_publisher_delete_post( WP_REST_Request $req ) {
    $id = (int) $req->get_param( 'id' );
    // Trash, not force-delete: some sites run plugins/themes whose cleanup hooks
    // crash on a hard delete (fatal error on the site), and trash is reversible.
    $result = wp_trash_post( $id );
    if ( ! $result ) return new WP_Error( 'delete_failed', 'Could not trash post', [ 'status' => 500 ] );
    return rest_ensure_response( [ 'ok' => true, 'deleted_id' => $id, 'trashed' => true ] );
}

// â”€â”€â”€ Pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function pb_publisher_list_pages( WP_REST_Request $req ): WP_REST_Response {
    $pages = get_pages( [
        'post_status' => $req->get_param( 'status' ) ?: 'any',
        'number'      => min( (int) ( $req->get_param( 'per_page' ) ?: 50 ), 200 ),
    ] );
    return rest_ensure_response( array_map( 'pb_publisher_format_post', $pages ?: [] ) );
}

function pb_publisher_create_page( WP_REST_Request $req ) {
    return pb_publisher_insert_or_update_post( 0, $req->get_json_params(), 'page' );
}

function pb_publisher_update_page( WP_REST_Request $req ) {
    return pb_publisher_insert_or_update_post( (int) $req->get_param( 'id' ), $req->get_json_params(), 'page' );
}

function pb_publisher_delete_page( WP_REST_Request $req ) {
    $id     = (int) $req->get_param( 'id' );
    $result = wp_trash_post( $id );
    if ( ! $result ) return new WP_Error( 'delete_failed', 'Could not trash page', [ 'status' => 500 ] );
    return rest_ensure_response( [ 'ok' => true, 'deleted_id' => $id, 'trashed' => true ] );
}

// â”€â”€â”€ Shared post/page upsert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function pb_publisher_insert_or_update_post( int $existing_id, array $p, string $post_type ) {
    $data = [ 'post_type' => $post_type ];

    if ( $existing_id ) $data['ID'] = $existing_id;
    if ( isset( $p['title'] ) )   $data['post_title']   = sanitize_text_field( $p['title'] );
    if ( isset( $p['content'] ) ) $data['post_content']  = wp_kses_post( $p['content'] );
    if ( isset( $p['excerpt'] ) ) $data['post_excerpt']  = sanitize_text_field( $p['excerpt'] );
    if ( isset( $p['status'] ) && in_array( $p['status'], [ 'publish', 'draft', 'future', 'pending', 'private' ], true ) ) {
        $data['post_status'] = $p['status'];
    }
    if ( isset( $p['date'] ) ) {
        $data['post_date']     = get_date_from_gmt( $p['date'], 'Y-m-d H:i:s' );
        $data['post_date_gmt'] = gmdate( 'Y-m-d H:i:s', strtotime( $p['date'] ) );
    }
    if ( isset( $p['slug'] ) ) $data['post_name'] = sanitize_title( $p['slug'] );
    if ( isset( $p['parent_id'] ) ) $data['post_parent'] = (int) $p['parent_id'];
    if ( isset( $p['author_id'] ) ) $data['post_author'] = (int) $p['author_id'];

    if ( $post_type === 'post' ) {
        if ( ! empty( $p['tags'] ) )     $data['tags_input']    = array_map( 'sanitize_text_field', (array) $p['tags'] );
        if ( ! empty( $p['category'] ) ) {
            $cat_name = sanitize_text_field( $p['category'] );
            // sanitize_key() (lowercase + underscores) never matches a real category
            // slug (hyphenated), so this used to silently fail and posts fell back to
            // "Uncategorized". Match by name first, then slug, then create it.
            $term = get_term_by( 'name', $cat_name, 'category' );
            if ( ! $term ) {
                $term = get_term_by( 'slug', sanitize_title( $cat_name ), 'category' );
            }
            if ( ! $term ) {
                $inserted = wp_insert_term( $cat_name, 'category' );
                if ( ! is_wp_error( $inserted ) ) {
                    $data['post_category'] = [ (int) $inserted['term_id'] ];
                }
            } else {
                $data['post_category'] = [ (int) $term->term_id ];
            }
        }
    }

    $post_id = $existing_id ? wp_update_post( $data, true ) : wp_insert_post( $data, true );

    if ( is_wp_error( $post_id ) ) {
        return new WP_Error( 'save_failed', $post_id->get_error_message(), [ 'status' => 500 ] );
    }

    // SEO meta
    if ( ! empty( $p['meta_description'] ) ) {
        $desc = sanitize_text_field( $p['meta_description'] );
        update_post_meta( $post_id, '_yoast_wpseo_metadesc', $desc );
        update_post_meta( $post_id, 'rank_math_description',  $desc );
    }
    if ( ! empty( $p['meta_title'] ) ) {
        $title = sanitize_text_field( $p['meta_title'] );
        update_post_meta( $post_id, '_yoast_wpseo_title', $title );
        update_post_meta( $post_id, 'rank_math_title',    $title );
    }

    // Arbitrary meta
    if ( ! empty( $p['meta'] ) && is_array( $p['meta'] ) ) {
        foreach ( $p['meta'] as $key => $value ) {
            update_post_meta( $post_id, sanitize_key( $key ), sanitize_text_field( $value ) );
        }
    }

    // Featured image
    if ( ! empty( $p['featured_image_id'] ) ) {
        set_post_thumbnail( $post_id, (int) $p['featured_image_id'] );
    }

    return rest_ensure_response( [
        'ok'      => true,
        'post_id' => $post_id,
        'url'     => get_permalink( $post_id ),
    ] );
}

function pb_publisher_format_post( WP_Post $post ): array {
    return [
        'id'         => $post->ID,
        'title'      => $post->post_title,
        'status'     => $post->post_status,
        'url'        => get_permalink( $post->ID ),
        'date'       => $post->post_date_gmt,
        'modified'   => $post->post_modified_gmt,
        'excerpt'    => $post->post_excerpt,
        'thumbnail'  => get_the_post_thumbnail_url( $post->ID, 'full' ) ?: null,
    ];
}

// â”€â”€â”€ Media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function pb_publisher_list_media( WP_REST_Request $req ): WP_REST_Response {
    $media = get_posts( [
        'post_type'      => 'attachment',
        'post_status'    => 'any',
        'posts_per_page' => min( (int) ( $req->get_param( 'per_page' ) ?: 20 ), 100 ),
        'paged'          => max( 1, (int) ( $req->get_param( 'page' ) ?: 1 ) ),
    ] );
    return rest_ensure_response( array_map( function( $m ) {
        return [
            'id'       => $m->ID,
            'url'      => wp_get_attachment_url( $m->ID ),
            'filename' => basename( get_attached_file( $m->ID ) ),
            'mime'     => $m->post_mime_type,
            'alt'      => get_post_meta( $m->ID, '_wp_attachment_image_alt', true ),
            'caption'  => $m->post_excerpt,
            'date'     => $m->post_date_gmt,
        ];
    }, $media ) );
}

function pb_publisher_upload_media( WP_REST_Request $req ) {
    $p = $req->get_json_params();

    if ( empty( $p['file_data'] ) || empty( $p['file_name'] ) ) {
        return new WP_Error( 'missing_params', 'file_data and file_name are required', [ 'status' => 400 ] );
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $file_data = base64_decode( $p['file_data'] );
    if ( $file_data === false ) {
        return new WP_Error( 'invalid_base64', 'file_data must be valid base64', [ 'status' => 400 ] );
    }

    $upload = wp_upload_bits( sanitize_file_name( $p['file_name'] ), null, $file_data );
    if ( $upload['error'] ) {
        return new WP_Error( 'upload_failed', $upload['error'], [ 'status' => 500 ] );
    }

    $mime_type = ! empty( $p['mime_type'] ) ? $p['mime_type'] : wp_check_filetype( $upload['file'] )['type'];

    $attachment_id = wp_insert_attachment( [
        'post_title'     => sanitize_text_field( pathinfo( $p['file_name'], PATHINFO_FILENAME ) ),
        'post_mime_type' => $mime_type,
        'post_status'    => 'inherit',
        'post_excerpt'   => sanitize_text_field( $p['caption'] ?? '' ),
    ], $upload['file'] );

    if ( is_wp_error( $attachment_id ) ) {
        return $attachment_id;
    }

    wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $upload['file'] ) );

    if ( ! empty( $p['alt_text'] ) ) {
        update_post_meta( $attachment_id, '_wp_attachment_image_alt', sanitize_text_field( $p['alt_text'] ) );
    }

    // Optionally attach to a post
    if ( ! empty( $p['post_id'] ) ) {
        wp_update_post( [ 'ID' => $attachment_id, 'post_parent' => (int) $p['post_id'] ] );
    }

    return rest_ensure_response( [
        'ok'            => true,
        'attachment_id' => $attachment_id,
        'url'           => wp_get_attachment_url( $attachment_id ),
    ] );
}

function pb_publisher_delete_media( WP_REST_Request $req ) {
    $id     = (int) $req->get_param( 'id' );
    $result = wp_delete_attachment( $id, true );
    if ( ! $result ) return new WP_Error( 'delete_failed', 'Could not delete attachment', [ 'status' => 500 ] );
    return rest_ensure_response( [ 'ok' => true, 'deleted_id' => $id ] );
}

// â”€â”€â”€ Site Options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Allowlisted options safe to read/write remotely */
const PB_ALLOWED_OPTIONS = [
    'blogname', 'blogdescription', 'admin_email',
    'posts_per_page', 'default_category', 'date_format', 'time_format',
];

function pb_publisher_get_options(): WP_REST_Response {
    $out = [];
    foreach ( PB_ALLOWED_OPTIONS as $key ) {
        $out[ $key ] = get_option( $key );
    }
    return rest_ensure_response( $out );
}

function pb_publisher_set_options( WP_REST_Request $req ): WP_REST_Response {
    $p       = $req->get_json_params();
    $updated = [];
    foreach ( PB_ALLOWED_OPTIONS as $key ) {
        if ( array_key_exists( $key, $p ) ) {
            update_option( $key, sanitize_text_field( $p[ $key ] ) );
            $updated[] = $key;
        }
    }
    return rest_ensure_response( [ 'ok' => true, 'updated' => $updated ] );
}

// â”€â”€â”€ Auto-update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

add_filter( 'pre_set_site_transient_update_plugins', 'pb_publisher_check_updates' );
function pb_publisher_check_updates( $transient ) {
    if ( empty( $transient->checked ) ) return $transient;

    $response = wp_remote_get( PB_PUBLISHER_UPDATE_URL, [ 'timeout' => 8, 'sslverify' => true ] );
    if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
        return $transient;
    }

    $data = json_decode( wp_remote_retrieve_body( $response ) );
    if ( ! $data || empty( $data->version ) ) return $transient;

    $plugin_file = plugin_basename( __FILE__ );

    if ( version_compare( PB_PUBLISHER_VERSION, $data->version, '<' ) ) {
        $transient->response[ $plugin_file ] = (object) [
            'slug'        => 'pb-publisher',
            'plugin'      => $plugin_file,
            'new_version' => $data->version,
            'url'         => 'https://github.com/pitchblackau/wp-ai-publisher',
            'package'     => $data->download_url,
            'tested'      => $data->tested_wp ?? '',
            'requires'    => $data->requires_wp ?? '5.6',
        ];
    }

    return $transient;
}

add_filter( 'plugins_api', 'pb_publisher_plugin_info', 20, 3 );
function pb_publisher_plugin_info( $result, $action, $args ) {
    if ( $action !== 'plugin_information' || ( $args->slug ?? '' ) !== 'pb-publisher' ) {
        return $result;
    }
    $response = wp_remote_get( PB_PUBLISHER_UPDATE_URL, [ 'timeout' => 8 ] );
    if ( is_wp_error( $response ) ) return $result;
    $data = json_decode( wp_remote_retrieve_body( $response ) );
    if ( ! $data ) return $result;

    return (object) [
        'name'          => 'Pitch Black Publisher',
        'slug'          => 'pb-publisher',
        'version'       => $data->version,
        'author'        => 'Pitch Black',
        'download_link' => $data->download_url,
        'requires'      => $data->requires_wp ?? '5.6',
        'tested'        => $data->tested_wp   ?? '6.6',
        'sections'      => [ 'description' => 'Secure REST API bridge for WP AI Publisher.', 'changelog' => $data->changelog ?? '' ],
    ];
}

// â”€â”€â”€ Admin settings page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

add_action( 'admin_menu', 'pb_publisher_admin_menu' );
function pb_publisher_admin_menu(): void {
    add_options_page( 'Pitch Black Publisher', 'PB Publisher', 'manage_options', 'pb-publisher', 'pb_publisher_settings_page' );
}

add_action( 'admin_init', 'pb_publisher_handle_regenerate' );
function pb_publisher_handle_regenerate(): void {
    if ( isset( $_POST['pb_regenerate_key'] ) && check_admin_referer( 'pb_regenerate_key_action' ) && current_user_can( 'manage_options' ) ) {
        update_option( PB_PUBLISHER_KEY_OPTION, wp_generate_password( 48, false ) );
        wp_redirect( admin_url( 'options-general.php?page=pb-publisher&regenerated=1' ) );
        exit;
    }
}

function pb_publisher_settings_page(): void {
    $key = get_option( PB_PUBLISHER_KEY_OPTION );
    ?>
    <div class="wrap">
        <h1>Pitch Black Publisher <span style="font-size:13px;color:#888;font-weight:normal;">v<?php echo PB_PUBLISHER_VERSION; ?></span></h1>

        <?php if ( isset( $_GET['regenerated'] ) ) : ?>
            <div class="notice notice-success"><p>API key regenerated. Update your WP AI Publisher dashboard with the new key.</p></div>
        <?php endif; ?>

        <table class="form-table" style="max-width:700px">
            <tr>
                <th style="width:140px">API Key</th>
                <td>
                    <code style="font-size:14px;background:#f0f0f0;padding:8px 14px;display:inline-block;border-radius:4px;user-select:all;word-break:break-all;"><?php echo esc_html( $key ); ?></code>
                    <p class="description">Copy this into the WP AI Publisher dashboard when adding this site.</p>
                </td>
            </tr>
            <tr>
                <th>Status endpoint</th>
                <td><code><?php echo esc_url( rest_url( 'pb-publisher/v1/status' ) ); ?></code></td>
            </tr>
            <tr>
                <th>Plugin version</th>
                <td><?php echo PB_PUBLISHER_VERSION; ?> â€” <a href="https://github.com/pitchblackau/wp-ai-publisher/tree/master/plugin" target="_blank">changelog</a></td>
            </tr>
        </table>

        <form method="post" style="margin-top:1em">
            <?php wp_nonce_field( 'pb_regenerate_key_action' ); ?>
            <input type="submit" name="pb_regenerate_key" class="button button-secondary" value="Regenerate Key"
                onclick="return confirm('This disconnects the dashboard until you update the key there. Continue?');" />
        </form>
    </div>
    <?php
}
