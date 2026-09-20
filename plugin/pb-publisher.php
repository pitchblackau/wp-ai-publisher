<?php
/**
 * Plugin Name: Pitch Black Publisher
 * Plugin URI:  https://pitchblack.au
 * Description: Secure REST API bridge for WP AI Publisher. Install, copy the key, done.
 * Version:     1.0.0
 * Author:      Pitch Black
 * License:     GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'PB_PUBLISHER_VERSION', '1.0.0' );
define( 'PB_PUBLISHER_KEY_OPTION', 'pb_publisher_secret_key' );

// ─── Activation ──────────────────────────────────────────────────────────────

register_activation_hook( __FILE__, 'pb_publisher_activate' );
function pb_publisher_activate() {
    if ( ! get_option( PB_PUBLISHER_KEY_OPTION ) ) {
        update_option( PB_PUBLISHER_KEY_OPTION, wp_generate_password( 48, false ) );
    }
}

// ─── REST API ─────────────────────────────────────────────────────────────────

add_action( 'rest_api_init', 'pb_publisher_register_routes' );
function pb_publisher_register_routes() {
    $namespace = 'pb-publisher/v1';

    register_rest_route( $namespace, '/status', [
        'methods'             => 'GET',
        'callback'            => 'pb_publisher_status',
        'permission_callback' => 'pb_publisher_auth',
    ] );

    register_rest_route( $namespace, '/posts', [
        'methods'             => 'POST',
        'callback'            => 'pb_publisher_create_post',
        'permission_callback' => 'pb_publisher_auth',
    ] );
}

function pb_publisher_auth( WP_REST_Request $request ) {
    $stored = get_option( PB_PUBLISHER_KEY_OPTION );
    if ( ! $stored ) return false;

    $provided = $request->get_header( 'X-PB-Key' );
    if ( ! $provided ) $provided = $request->get_param( 'pb_key' );
    if ( ! $provided ) return false;

    return hash_equals( $stored, $provided );
}

function pb_publisher_status( WP_REST_Request $request ) {
    global $wp_version;
    return rest_ensure_response( [
        'ok'          => true,
        'site_name'   => get_bloginfo( 'name' ),
        'site_url'    => get_site_url(),
        'wp_version'  => $wp_version,
        'pb_version'  => PB_PUBLISHER_VERSION,
    ] );
}

function pb_publisher_create_post( WP_REST_Request $request ) {
    $params = $request->get_json_params();

    $title   = sanitize_text_field( $params['title']   ?? '' );
    $content = wp_kses_post( $params['content']        ?? '' );
    $status  = sanitize_key( $params['status']         ?? 'draft' );

    if ( ! in_array( $status, [ 'publish', 'draft', 'future', 'pending' ], true ) ) {
        $status = 'draft';
    }

    $post_data = [
        'post_title'   => $title,
        'post_content' => $content,
        'post_status'  => $status,
        'post_author'  => get_current_user_id() ?: 1,
    ];

    if ( ! empty( $params['date'] ) ) {
        $post_data['post_date']     = get_date_from_gmt( $params['date'], 'Y-m-d H:i:s' );
        $post_data['post_date_gmt'] = date( 'Y-m-d H:i:s', strtotime( $params['date'] ) );
    }

    if ( ! empty( $params['category'] ) ) {
        $cat = get_category_by_slug( sanitize_key( $params['category'] ) );
        if ( $cat ) $post_data['post_category'] = [ $cat->term_id ];
    }

    if ( ! empty( $params['tags'] ) && is_array( $params['tags'] ) ) {
        $post_data['tags_input'] = array_map( 'sanitize_text_field', $params['tags'] );
    }

    $post_id = wp_insert_post( $post_data, true );

    if ( is_wp_error( $post_id ) ) {
        return new WP_Error( 'publish_failed', $post_id->get_error_message(), [ 'status' => 500 ] );
    }

    // SEO meta (Yoast / RankMath / plain meta)
    if ( ! empty( $params['meta'] ) && is_array( $params['meta'] ) ) {
        foreach ( $params['meta'] as $key => $value ) {
            update_post_meta( $post_id, sanitize_key( $key ), sanitize_text_field( $value ) );
        }
    }

    // Yoast meta description shortcut
    if ( ! empty( $params['meta_description'] ) ) {
        update_post_meta( $post_id, '_yoast_wpseo_metadesc', sanitize_text_field( $params['meta_description'] ) );
        update_post_meta( $post_id, 'rank_math_description',  sanitize_text_field( $params['meta_description'] ) );
    }

    return rest_ensure_response( [
        'ok'      => true,
        'post_id' => $post_id,
        'url'     => get_permalink( $post_id ),
    ] );
}

// ─── Admin settings page ──────────────────────────────────────────────────────

add_action( 'admin_menu', 'pb_publisher_admin_menu' );
function pb_publisher_admin_menu() {
    add_options_page(
        'Pitch Black Publisher',
        'PB Publisher',
        'manage_options',
        'pb-publisher',
        'pb_publisher_settings_page'
    );
}

add_action( 'admin_init', 'pb_publisher_handle_regenerate' );
function pb_publisher_handle_regenerate() {
    if (
        isset( $_POST['pb_regenerate_key'] ) &&
        check_admin_referer( 'pb_regenerate_key_action' ) &&
        current_user_can( 'manage_options' )
    ) {
        update_option( PB_PUBLISHER_KEY_OPTION, wp_generate_password( 48, false ) );
        wp_redirect( admin_url( 'options-general.php?page=pb-publisher&regenerated=1' ) );
        exit;
    }
}

function pb_publisher_settings_page() {
    $key = get_option( PB_PUBLISHER_KEY_OPTION );
    ?>
    <div class="wrap">
        <h1>Pitch Black Publisher</h1>

        <?php if ( isset( $_GET['regenerated'] ) ) : ?>
            <div class="notice notice-success"><p>API key regenerated. Update your dashboard with the new key.</p></div>
        <?php endif; ?>

        <table class="form-table">
            <tr>
                <th>API Key</th>
                <td>
                    <code style="font-size:14px;background:#f0f0f0;padding:8px 12px;display:inline-block;border-radius:4px;user-select:all;"><?php echo esc_html( $key ); ?></code>
                    <p class="description">Copy this key into the WP AI Publisher dashboard when adding this site.</p>
                </td>
            </tr>
            <tr>
                <th>Endpoint</th>
                <td>
                    <code><?php echo esc_url( get_rest_url( null, 'pb-publisher/v1/status' ) ); ?></code>
                </td>
            </tr>
        </table>

        <form method="post">
            <?php wp_nonce_field( 'pb_regenerate_key_action' ); ?>
            <p><input type="submit" name="pb_regenerate_key" class="button button-secondary" value="Regenerate Key" onclick="return confirm('This will disconnect the dashboard until you update the key there. Continue?');" /></p>
        </form>
    </div>
    <?php
}
