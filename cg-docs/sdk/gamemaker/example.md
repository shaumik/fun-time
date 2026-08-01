<!-- https://docs.crazygames.com/sdk/gamemaker/example/ -->

# Example

The sample project shows a full example of displaying ads in Game Maker Studio 2, written in GML. This is a very basic project that uses:

- one object, `mgr_game`, that has been placed in the starting room,

- a script, `functions`, and

- a sound resource, `bgm_main` (to test pausing/resuming of audio). Courtesy of Rafel Krux and used under a Creative Commons license.

To test the SDK:

- Press `enter` to trigger a midgame ad break. You should see an overlay for a few seconds.

- Press `space` to trigger a rewarded ad. You should see an overlay for a few seconds.

- Press `esc` to trigger show/hide banner ads.

- Press `P` to see the invite link. Copy the parameters (from "?" until the end) and append them to the end of the URL in your address bar and go to that URL. Once your game loads, you can now press `L` to test retrieving the value for the key "roomId".

- Press `U` to see the userInfo contents.

## mgr_game (object)

```
/// CREATE EVENT

domain = url_get_domain();

if (
    !debug_mode &&
    string_pos( ".crazygames.", domain ) == 0 &&
    string_pos( ".1001juegos.com", domain ) == 0
){
    game_end();
}

crazy_init();

global.ad_is_playing = false;
global.rewarded_requested = false;
global.show_banner_ads = false;
global.ad_blocker_detected = false;

if ( !variable_global_exists("user_info") ) {
    global.user_info = noone;
}

audio_play_sound( bgm_main, 0, true );
```

```
/// STEP EVENT

if ( !global.ad_is_playing ) {

    if ( keyboard_check_pressed( vk_enter ) ) {

        crazy_break("midgame");

    } else if ( keyboard_check_pressed( vk_space ) ) {

        global.reward_requested = true;
        crazy_break("rewarded");

    } else if ( keyboard_check_pressed( vk_escape ) ) {

        if ( global.show_banner_ads ) {

            global.show_banner_ads = false;
            crazy_hide_all_banners();

        } else {

            global.show_banner_ads = true;

            args = [
                {
                    containerId: "crazy_banner_1",
                    size: "320x50",
                },
                {
                    containerId: "crazy_banner_2",
                    size: "300x250",
                },

            ];
            args_json = json_stringify( args );
            crazy_request_banner( args_json );

            crazy_show_banner("crazy_banner_1");
            crazy_show_banner("crazy_banner_2");

        }

    } else if ( keyboard_check_pressed( ord("P") ) ) {

        args = {
            room_id: 12345,
            game_mode:"pvp",
            duration: 60,
        };
        args_json = json_stringify( args );
        invite_link = crazy_invite_link( args_json );

        show_message( "Invite link:\n" + string(invite_link) );

    } else if ( keyboard_check_pressed( ord("L") ) ) {

        room_id = crazy_get_invite_param( "room_id" );
        show_message( room_id );

    } else if ( keyboard_check_pressed( ord("U") ) ) {

        show_message( "global.user_info:\n" + string(global.user_info) );

    }
}
```

## functions (script)

```
function gmcallback_crazy_callback( _event, _output ){

    if ( _event == "crazy.break.started" ) {

        global.ad_is_playing = true;
        audio_pause_all();

    } else if ( _event == "crazy.break.error" ) {

        global.ad_is_playing = false;
        if ( global.reward_requested ) {
            global.rewarded_requested = false;

            // Tell the player there was an error loading the ad, that
            // they should try the action again to request their reward.

        }
        audio_resume_all();

    } else if ( _event == "crazy.break.finished" ) {

        global.ad_is_playing = false;
        if ( global.reward_requested ) {
            global.rewarded_requested = false;

            // Code to grant reward to player would go here.

        }
        audio_resume_all();

    } else if ( _event == "crazy.banner.rendered" ) {

        // The banner rendered successfully.

    } else if ( _event == "crazy.banner.error" ) {

        // The banner request failed, so let's try again.

        args = [
            {
                containerId: "crazy_banner_1",
                size: "320x50",
            },
            {
                containerId: "crazy_banner_2",
                size: "300x250",
            },

        ];
        args_json = json_stringify( args );
        crazy_request_banner( args_json );

        crazy_show_banner("crazy_banner_1");
        crazy_show_banner("crazy_banner_2");

    } else if ( _event == "crazy.adblock.detected" ) {

        // An ad blocker was detected.
        global.ad_blocker_detected = true;

    } else if ( _event == "crazy.adblock.notDetected" ) {

        // An ad blocker was NOT detected.
        global.ad_blocker_detected = false;

    } else if ( _event == "crazy.sdk.initialized" ) {

        // The SDK was initialized. Get the user_info object.
        global.user_info = json_parse(_output);
        show_debug_message( global.user_info );

    }

}
```
