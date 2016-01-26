#include <pebble.h>
#include "my_math.h"
#include "reglages.h"
static Window    *s_main_window;
static TextLayer *s_date_layer;
static TextLayer *s_time_layer;
static TextLayer *s_text_solar_layer;
static TextLayer *s_solar_layer;
static TextLayer *s_gmtime_layer;
static TextLayer *s_text_eot_layer;
static TextLayer *s_eot_layer;
static TextLayer *s_text_longitude_difference_layer;
static TextLayer *s_longitude_difference_h_layer;
static TextLayer *s_longitude_difference_d_layer;
static TextLayer *s_text_battery_layer;
static TextLayer *s_battery_layer;
static TextLayer *s_text_posAJour_layer;
static TextLayer *s_posAJour_layer;
time_t clock_time_t = 0;
time_t lastTime;
time_t lastTime2;
int posAJour;
time_t utc_time_t = 0;
time_t solar_time_t = 0;
int32_t corr_eotd_received;
double corr_eotd = 0;
double eotd;
int32_t longitude_received;
float longitude;
float longitude_difference;
int long_dif_h;
int long_dif_hm;
int long_dif_hs;
int long_dif_d;
int long_dif_dm;
int long_dif_ds;
struct tm clock_time_tm   = { .tm_hour = 0, .tm_min = 0 };
struct tm utc_time_tm   = { .tm_hour = 0, .tm_min = 0 };
struct tm solar_time_tm   = { .tm_hour = 0, .tm_min = 0 };
int32_t timezoneOffset;
int32_t time_zone;
int eotMinInt;
int eotSecInt;
static void update_time();
static void affichage();
static void eot();
static void long_dif();
static void solar_time();

static void handle_battery(BatteryChargeState charge_state) {
  static char battery_text[] = "charge";
#if defined(PBL_SDK_3)
  if (charge_state.is_charging) {
    snprintf(battery_text, sizeof(battery_text), "charge");
    text_layer_set_text_color(s_text_battery_layer, GColorGreen);
    text_layer_set_text_color(s_battery_layer, GColorGreen); 
  } else {
    if (charge_state.charge_percent < 20){
      text_layer_set_text_color(s_text_battery_layer, GColorRed);
      text_layer_set_text_color(s_battery_layer, GColorRed);  
    }
    else{
      text_layer_set_text_color(s_text_battery_layer, GColorWhite);
      text_layer_set_text_color(s_battery_layer, GColorWhite); 
    }
    snprintf(battery_text, sizeof(battery_text), "%d%%", charge_state.charge_percent);
  }
#elif defined(PBL_SDK_2)
   if (charge_state.is_charging) {
    snprintf(battery_text, sizeof(battery_text), "charge");
  } 
  else {
    snprintf(battery_text, sizeof(battery_text), "%d%%", charge_state.charge_percent);
    }
    text_layer_set_text_color(s_text_battery_layer, GColorWhite);
    text_layer_set_text_color(s_battery_layer, GColorWhite); 
#endif
  text_layer_set_text(s_battery_layer, battery_text);
}

static void send_request(int command) {
  Tuplet command_tuple = TupletInteger(0 /*KEY_COMMAND*/ , command);
  Tuplet index_tuple = TupletInteger(1 /*KEY_INDEX*/, 0 /*entryIndex*/);
  DictionaryIterator *iter;
  app_message_outbox_begin(&iter);
  if (iter == NULL)
     return;
    
  dict_write_tuplet(iter, &command_tuple);
  dict_write_tuplet(iter, &index_tuple);
  dict_write_end(iter);
  app_message_outbox_send();
}

static void affichage(){
  
  // Create a long-lived buffer
  static char buffer_date[] = "jj.mm.aaaa";
  static char buffer_t[] = "00:00";
  static char buffer_gmt[] = "XXX  00:00";
  static char buffer_text_solar[] = "Temps solaire vrai";
  static char buffer_solar[] = "XXXXxx 00:00";
  static char buffer_text_eot[] = "Equation du temps";
  static char buffer_eot[] = "000:000X";
  static char buffer_text_longitude_difference[] = "Différence de long.";
  static char buffer_longitude_difference_h[] = "---h--m--s";
  static char buffer_longitude_difference_d[] = "---°--'--";
  static char buffer_text_battery[] = "Bat.";
  static char buffer_text_posAJour[] = "Pos.\nM.àJ.";
  static char buffer_posAJour[] = "+ -h";

  // Write the current hours and minutes into the buffer
  strftime(buffer_date, sizeof("jj.mm.aaaa"), "%e.%m.%y", &clock_time_tm);
  strftime(buffer_t, sizeof("00:00"), "%k:%M", &clock_time_tm);
  strftime(buffer_gmt, sizeof("XXX  00:00"), "UTC  %k:%M", &utc_time_tm);
  snprintf(buffer_text_solar, sizeof("Temps solaire vrai"), "Temps solaire vrai");
  strftime(buffer_solar, sizeof("XXXXxx 00:00"), "%k:%M", &solar_time_tm);
  snprintf(buffer_text_longitude_difference, sizeof("Différence de long."), "Différence de long.");
  if ((long_dif_h == 0) && (long_dif_hm == 0)){
    snprintf(buffer_longitude_difference_h, sizeof("SSs"), "%ds", long_dif_hs);
  }
  else if (long_dif_h == 0){
    snprintf(buffer_longitude_difference_h, sizeof("MMm SSs"), "%dm %ds", long_dif_hm, long_dif_hs);
  }
  else {
    snprintf(buffer_longitude_difference_h, sizeof("XHHhMMmSSs"), "%dh%dm%ds", long_dif_h, long_dif_hm, long_dif_hs);
  }
  if ((long_dif_d == 0) && (long_dif_dm == 0)){
    snprintf(buffer_longitude_difference_d, sizeof("SSX"), "%d\"", long_dif_ds);
  }
  else if (long_dif_d == 0){
    snprintf(buffer_longitude_difference_d, sizeof("MM' SSX"), "%d' %d\"", long_dif_dm, long_dif_ds);
  }
  else {
    snprintf(buffer_longitude_difference_d, sizeof("XDD°MM'SSX"), "%d°%d'%d\"", long_dif_d, long_dif_dm, long_dif_ds);
  }
  snprintf(buffer_text_eot, sizeof("Equation du temps"), "Equation du temps");
  if ( eotMinInt == 0)
    {
    snprintf(buffer_eot, sizeof("000X"), "%ds", eotSecInt);
  }
  else
    {
    snprintf(buffer_eot, sizeof("000:000X"), "%dm %ds", eotMinInt , eotSecInt);
  }
  snprintf(buffer_text_battery, sizeof("Bat."), "Bat.");
  snprintf(buffer_text_posAJour, sizeof("Pos.\nM.àJ."), "Pos.\nM.àJ.");
  if (posAJour > 9){
    snprintf(buffer_posAJour, sizeof("+ -h"), "+ 9h");}
  else{
    snprintf(buffer_posAJour, sizeof("+ -h"), "+ %dh", posAJour);
  }
  
  // Display this time on the TextLayer
  text_layer_set_text(s_date_layer, buffer_date);
  text_layer_set_text(s_time_layer, buffer_t);
  text_layer_set_text(s_gmtime_layer, buffer_gmt);
  text_layer_set_text(s_text_solar_layer, buffer_text_solar);
  text_layer_set_text(s_solar_layer, buffer_solar);
  text_layer_set_text(s_text_longitude_difference_layer, buffer_text_longitude_difference);
  text_layer_set_text(s_longitude_difference_h_layer, buffer_longitude_difference_h);
  text_layer_set_text(s_longitude_difference_d_layer, buffer_longitude_difference_d);
  text_layer_set_text(s_text_eot_layer, buffer_text_eot);
  text_layer_set_text(s_eot_layer, buffer_eot);
  text_layer_set_text(s_text_battery_layer, buffer_text_battery);
  text_layer_set_text(s_text_posAJour_layer, buffer_text_posAJour);
  text_layer_set_text(s_posAJour_layer, buffer_posAJour);
}

static void update_time() {
  // Get a tm structure
  clock_time_t = time(NULL);
  clock_time_tm = *localtime(&clock_time_t);
  #if defined(PBL_SDK_3)
  utc_time_t  = clock_time_t;
  #elif defined(PBL_SDK_2)
  utc_time_t  = clock_time_t + timezoneOffset; 
  #endif
  #if defined(PBL_SDK_3)
  utc_time_tm = *gmtime(&utc_time_t);  
  #elif defined(PBL_SDK_2)
  utc_time_tm = *localtime(&utc_time_t);
  #endif
  eot();
  long_dif();
  solar_time();
  
  //solar_time_tm = *localtime(&solar_time_t);
  solar_time_tm = *gmtime (&solar_time_t);
        
    if (solar_time_tm.tm_min >= 60) {
        solar_time_tm.tm_min -= 60;
        solar_time_tm.tm_hour += 1;
    }  
    if (solar_time_tm.tm_hour == 24) {
        solar_time_tm.tm_hour = 0;
    }
    if (solar_time_tm.tm_hour > 24) {
        solar_time_tm.tm_hour = solar_time_tm.tm_hour - 24;
    }
    if (solar_time_tm.tm_hour < 0) {
        solar_time_tm.tm_hour = solar_time_tm.tm_hour + 24;
    }  
  posAJour = ((clock_time_t / 3600.0) - (lastTime / 60.0));
  //posAJour = ((clock_time_t / 60)-(lastTime));
  //posAJour = 2; // test
  #if defined(PBL_SDK_3)
  if (posAJour > 4)/*(posAJour > (INTERV_MAJ_DONNEE / 60) - (INTERV_MAJ_DONNEE_APRES_ECHEC / 60))*/
  {
    text_layer_set_text_color(s_text_posAJour_layer, GColorRed);
    text_layer_set_text_color(s_posAJour_layer, GColorRed);}
  else{
    text_layer_set_text_color(s_text_posAJour_layer, GColorWhite);
    text_layer_set_text_color(s_posAJour_layer, GColorWhite);}
  #elif defined(PBL_SDK_2)
    text_layer_set_text_color(s_text_posAJour_layer, GColorWhite);
    text_layer_set_text_color(s_posAJour_layer, GColorWhite);
  #endif
/*
    if (((lastTime + (INTERV_MAJ_DONNEE)) < (clock_time_t / 60)) && ((lastTime2 + (INTERV_MAJ_DONNEE_APRES_ECHEC)) < (clock_time_t / 60))) 
    {   
        //Vibreur
        //vibes_double_pulse();
        lastTime2 = (clock_time_t / 60);
        send_request(0); // request data refresh from phone JS         
    } 
  */
  affichage();
}

/******************
    APPMESSAGE STUFF
*******************/
enum {
    LONGITUDE = 2,
    OFFSET_TIMEZONE = 42, 
    TIME_ZONE = 43,  
    CORR_EOT = 45
};

void in_received_handler(DictionaryIterator *received, void *ctx) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "in_received_handler()");
  
    Tuple *longitude_tuple       = dict_find(received, LONGITUDE);
    Tuple *timezoneOffset_tuple  = dict_find(received, OFFSET_TIMEZONE);
    Tuple *time_zone_tuple       = dict_find(received, TIME_ZONE);
    Tuple *corr_eot_tuple        = dict_find(received, CORR_EOT);
  
   //Vibreur
   //vibes_short_pulse();
    
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Received from phone:");
  
    if (longitude_tuple) {         
        longitude_received = longitude_tuple->value->int32;
        longitude = longitude_received / 1000000.0;
    } 
  
    if (timezoneOffset_tuple) {         
        timezoneOffset = timezoneOffset_tuple->value->int32;
    } 
  
    if (time_zone_tuple) {         
        time_zone = time_zone_tuple->value->int32;
    }   

    if (corr_eot_tuple) {         
        corr_eotd_received = corr_eot_tuple->value->int32;
        corr_eotd = corr_eotd_received / 1000000.0;
    } 
  
  //longitude = 8;//test
  
  if (longitude > -181 && longitude < 181 && timezoneOffset > (-15 * 3600) && timezoneOffset < (17 * 3600) && time_zone > (3600 * -12) && time_zone < (3600 * 14) && corr_eotd > -30 && corr_eotd < 30)
    {
    lastTime = clock_time_t / 60;
  }
  else
    {
    // lecture des valeurs sauvegardées si elle existent, sinon: valeur par defaut
    longitude      = persist_exists(AD_MEM_LONGITUDE) ?      persist_read_int(AD_MEM_LONGITUDE) :      VAL_DEFAUT_LONGITUDE;
    longitude      = longitude / 10000;
    timezoneOffset = persist_exists(AD_MEM_TIMEZONEOFFSET) ? persist_read_int(AD_MEM_TIMEZONEOFFSET) : VAL_DEFAUT_TIMEZONEOFFSET;
    time_zone      = persist_exists(AD_MEM_TIME_ZONE) ?      persist_read_int(AD_MEM_TIME_ZONE) :      VAL_DEFAUT_TIME_ZONE;
    corr_eotd      = persist_exists(AD_MEM_CORR_EOTD) ?      persist_read_int(AD_MEM_CORR_EOTD) :      VAL_DEFAUT_CORR_EOTD;
    corr_eotd      = corr_eotd / 100;
    lastTime       = persist_exists(AD_MEM_LASTTIME) ?       persist_read_int(AD_MEM_LASTTIME) :       VAL_DEFAUT_LASTTIME;
  }

  update_time();
  
}

void in_dropped_handler(AppMessageResult reason, void *context) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Watch dropped data.");
}

void out_sent_handler(DictionaryIterator *sent, void *ctx) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Message sent to phone.");
}

void out_failed_handler(DictionaryIterator *failed, AppMessageResult reason, void *ctx) {
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Message FAILED to send to phone.");
}

static void eot(){
  /*
bbb = 367 * The_Year - 730531.5
ccc = int((7 * int(The_Year + (The_Month + 9) / 12)) / 4)
ddd = int(275 * The_Month / 9) + The_Day
D2000 = bbb - ccc + ddd + (The_Hour + The_Minute / 60 + The_Second / 3600) / 24
Cycle = int(D2000 / 365.25)
Theta = 0.0172024 * (D2000 - 365.25 * Cycle)
Average = 0.00526
Amp1 = 7.36303 - Cycle * 9e-05
Amp2 = 9.92465 - Cycle * 0.00014
Phi1 = 3.07892 + Cycle * -0.00019
Phi2 = -1.38995 + Cycle * 0.00013

EoT1 = Amp1 * sin(1 * (Theta + Phi1))
EoT2 = Amp2 * sin(2 * (Theta + Phi2))
EoT3 = 0.3173 * sin(3 * (Theta - 0.94686))
EoT4 = 0.21922 * sin(4 * (Theta - 0.60716))

EoT = Average + EoT1 + EoT2 + EoT3 + EoT4
*/
  
  //int eotMinInt;
  double eotSec;
  double j1970;
  double d2000;
  int cycle;
  double theta;
  double average;
  double amp1;
  double amp2;
  double phi1;
  double phi2;
  double eot1;
  double eot2;
  double eot3;
  double eot4;
  
  j1970 = utc_time_t/(3600.0F*24.0F);
  d2000 = j1970 - 11322.5F;
  cycle = d2000 / 365.25F;
  theta = 0.0172024F * (d2000 - 365.25F * cycle);
  average = 0.00526F;
  amp1 = 7.36303F - cycle * 9.0e-05;
  amp2 = 9.92465F - cycle * 0.00014F;
  phi1 = 3.07892F + cycle * -0.00019F;
  phi2 = -1.38995F + cycle * 0.00013F;
  //Calcul de l'équation du temps
  eot1 = amp1 * my_sin(1.0F * (theta + phi1));
  eot2 = amp2 * my_sin(2.0F * (theta + phi2));
  eot3 = 0.3173F* my_sin(3.0F * (theta - 0.94686F));
  eot4 = 0.21922F * my_sin(4.0F * (theta - 0.60716F));
  eotd = average + eot1 + eot2 + eot3 + eot4 + corr_eotd;
  //eotd = corr_eotd;

  //inversion du signe
  eotd = -eotd;

  //Test des arrondis
  //eotd = 1.53;
  
  eotMinInt = (int)eotd;
  
  eotSec = (eotd - eotMinInt) * 60.0;
  
//Arrondi des secondes
  if (eotd > 0){
    if ((eotSec - (int)eotSec) >= 0.5)
      {
      eotSec =  my_floor((eotd - eotMinInt)*60)+1;
      if (eotSec >= 60)
      {
        eotSec = 0;
        eotMinInt = eotMinInt + 1;
      }
    }
    else
      {
      eotSec =  my_floor((eotd - eotMinInt)*60);
    }
    if ((eotSec < 0) && eotMinInt != 0)
      {
      eotSecInt = -eotSec;
    }
    else{
      eotSecInt = eotSec;
    }
  }
else {
  //Equation du temps en positif pour l'arrondi
  eotSec = -eotSec;
  eotMinInt = -eotMinInt;
  eotd = -eotd;
  
  //Arrondi des secondes
    if ((eotSec - (int)eotSec) >= 0.5)
      {
      eotSec =  my_floor((eotd - eotMinInt)*60)+1;
      if (eotSec >= 60)
      {
        eotSec = 0;
        eotMinInt = eotMinInt + 1;
      }      
    }
    else
      {
      eotSec =  my_floor((eotd - eotMinInt)*60);
    }
  //Remise de l équation du temps en négatif
  eotSec = -eotSec;
  eotMinInt = -eotMinInt;
  eotd = -eotd;  
  
    //Si eotSec est négatif et eotMinInt n'est pas null, supprimer le signe -
    if ((eotSec < 0) && eotMinInt != 0)
      {
      eotSecInt = -eotSec;
    }
    else{
      eotSecInt = eotSec;
    }
  }  
}

static void long_dif(){
  longitude_difference = (time_zone / 3600.0 * 15.0) - (longitude);
  //longitude_difference =  (longitude) - (time_zone / 3600.0 * 15.0);
  long_dif_d = my_floor(longitude_difference);
  long_dif_dm = my_floor((longitude_difference - long_dif_d) * 60.0);
  long_dif_ds = my_floor((((longitude_difference - long_dif_d) * 60.0) - long_dif_dm)*60.0);
  if ((long_dif_dm < 0) && (long_dif_d != 0)){
    long_dif_dm = -long_dif_dm;
  }
  if ((long_dif_ds < 0) && ((long_dif_dm != 0) || (long_dif_d != 0))){
    long_dif_ds = -long_dif_ds;
  }
  
  long_dif_h = my_floor(longitude_difference / 15.0);
  long_dif_hm = my_floor(((longitude_difference / 15.0) - long_dif_h) * 60.0);
  long_dif_hs = my_floor(((((longitude_difference / 15.0) - long_dif_h) * 60.0) - long_dif_hm)*60.0);
  if ((long_dif_hm < 0) && (long_dif_h != 0)){
    long_dif_hm = -long_dif_hm;
  }
  if ((long_dif_hs < 0) && ((long_dif_hm != 0) || (long_dif_h != 0))){
    long_dif_hs = -long_dif_hs;
  }
}

static void solar_time(){
  //solar_time_t  = utc_time_t + time_zone + (eotd * 60.0) + (longitude_difference * 4.0 * 60.0);
  solar_time_t  = utc_time_t + time_zone - (eotd * 60.0) - (longitude_difference * 4.0 * 60.0);
}

static void main_window_load(Window *window) {
  window_set_background_color(s_main_window, GColorBlack);
  // Create date TextLayer
  s_date_layer = text_layer_create(GRect(0, -2, 144, 24));
  text_layer_set_background_color(s_date_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_date_layer, GColorCadetBlue);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_date_layer, GColorWhite);
  #endif
  text_layer_set_text(s_date_layer, "--.--.----");
  
  // Create time TextLayer
  s_time_layer = text_layer_create(GRect(0, 15, 144, 28));
  text_layer_set_background_color(s_time_layer, GColorClear);
  text_layer_set_text_color(s_time_layer, GColorWhite);
  text_layer_set_text(s_time_layer, "--:--");
  
  // Create gmtime TextLayer
  s_gmtime_layer = text_layer_create(GRect(0, 46, 144, 18));
  text_layer_set_background_color(s_gmtime_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_gmtime_layer, GColorCadetBlue);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_gmtime_layer, GColorWhite);
  #endif
  text_layer_set_text(s_gmtime_layer, "GMT  --:--");
  
  // Create solar_text TextLayer
  s_text_solar_layer = text_layer_create(GRect(0, 56, 144, 20));
  text_layer_set_background_color(s_text_solar_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_text_solar_layer, GColorYellow);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_text_solar_layer, GColorWhite);
  #endif
  text_layer_set_text(s_text_solar_layer, "Temps solaire vrai");
  
  // Create solar TextLayer
  s_solar_layer = text_layer_create(GRect(0, 68, 144, 24));
  text_layer_set_background_color(s_solar_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_solar_layer, GColorYellow);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_solar_layer, GColorWhite);
  #endif
  text_layer_set_text(s_solar_layer, "--:--");
  
  // Create text_longitude_difference TextLayer
  s_text_longitude_difference_layer = text_layer_create(GRect(0, 90, 144, 21));
  text_layer_set_background_color(s_text_longitude_difference_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_text_longitude_difference_layer, GColorGreen);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_text_longitude_difference_layer, GColorWhite);
  #endif
  text_layer_set_text(s_text_longitude_difference_layer, "Différence de long.");
  
  // Create longitude_difference_h TextLayer
  s_longitude_difference_h_layer = text_layer_create(GRect(-2, 108, 77, 18));
  text_layer_set_background_color(s_longitude_difference_h_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_longitude_difference_h_layer, GColorGreen);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_longitude_difference_h_layer, GColorWhite);
  #endif
  text_layer_set_text(s_longitude_difference_h_layer, "---h --m --s");
  
  // Create longitude_difference_d TextLayer
  s_longitude_difference_d_layer = text_layer_create(GRect(70, 108, 77, 18));
  text_layer_set_background_color(s_longitude_difference_d_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_longitude_difference_d_layer, GColorGreen);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_longitude_difference_d_layer, GColorWhite);
  #endif
  text_layer_set_text(s_longitude_difference_d_layer, "---° --m --s");
  
  // Create text_eot TextLayer
  s_text_eot_layer = text_layer_create(GRect(0, 126, 144, 20));
  text_layer_set_background_color(s_text_eot_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_text_eot_layer, GColorBrilliantRose);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_text_eot_layer, GColorWhite);
  #endif
  text_layer_set_text(s_text_eot_layer, "Equation du temps");
  
  // Create eot TextLayer
  s_eot_layer = text_layer_create(GRect(25, 144, 94, 18));
  text_layer_set_background_color(s_eot_layer, GColorClear);
  #if defined(PBL_SDK_3)
  text_layer_set_text_color(s_eot_layer, GColorBrilliantRose);
  #elif defined(PBL_SDK_2)
  text_layer_set_text_color(s_eot_layer, GColorWhite);
  #endif
  text_layer_set_text(s_eot_layer, "---m --s");
  
  // Creat text_battery TextLayer
  s_text_battery_layer = text_layer_create(GRect(0, 0, 144, 34));
  //text_layer_set_text_color(s_text_battery_layer, GColorWhite);
  text_layer_set_background_color(s_text_battery_layer, GColorClear);
  text_layer_set_text(s_text_battery_layer, "Bat.");
  
  // Creat battery TextLayer
  s_battery_layer = text_layer_create(GRect(0, 14, 144, 34));
  //text_layer_set_text_color(s_battery_layer, GColorWhite);
  text_layer_set_background_color(s_battery_layer, GColorClear);
  text_layer_set_text(s_battery_layer, "charge");
  
  // Creat text_posAJour TextLayer
  s_text_posAJour_layer = text_layer_create(GRect(0, 0, 144, 34));
  //text_layer_set_text_color(s_text_posAJour_layer, GColorWhite);
  text_layer_set_background_color(s_text_posAJour_layer, GColorClear);
  text_layer_set_text(s_text_posAJour_layer, "Pos.\nM.àJ.");
  
  // Creat posAJour TextLayer
  s_posAJour_layer = text_layer_create(GRect(0, 28, 144, 34));
  //text_layer_set_text_color(s_posAJour_layer, GColorWhite);
  text_layer_set_background_color(s_posAJour_layer, GColorClear);
  text_layer_set_text(s_posAJour_layer, "+ -h");

  // Improve the layout to be more like a watchface
  
  text_layer_set_font(s_date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_date_layer, GTextAlignmentCenter);
  
  text_layer_set_font(s_time_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text_alignment(s_time_layer, GTextAlignmentCenter);

  text_layer_set_font(s_gmtime_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_text_alignment(s_gmtime_layer, GTextAlignmentCenter);
  
  text_layer_set_font(s_text_solar_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_text_solar_layer, GTextAlignmentCenter);
  
  text_layer_set_font(s_solar_layer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(s_solar_layer, GTextAlignmentCenter);
  
  text_layer_set_font(s_text_longitude_difference_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_text_longitude_difference_layer, GTextAlignmentCenter);
  
  text_layer_set_font(s_longitude_difference_d_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_longitude_difference_d_layer, GTextAlignmentCenter);

  text_layer_set_font(s_longitude_difference_h_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_longitude_difference_h_layer, GTextAlignmentCenter);
  
  text_layer_set_font(s_text_eot_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_text_eot_layer, GTextAlignmentCenter);
  
  text_layer_set_font(s_eot_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_eot_layer, GTextAlignmentCenter);
  
  text_layer_set_font(s_text_battery_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_text_alignment(s_text_battery_layer, GTextAlignmentLeft);
  
  text_layer_set_font(s_battery_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_text_alignment(s_battery_layer, GTextAlignmentLeft);
  
  text_layer_set_font(s_text_posAJour_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_text_alignment(s_text_posAJour_layer, GTextAlignmentRight);
  
  text_layer_set_font(s_posAJour_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_text_alignment(s_posAJour_layer, GTextAlignmentRight);

  // Add it as a child layer to the Window's root layer
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_date_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_time_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_gmtime_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_text_solar_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_solar_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_text_longitude_difference_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_longitude_difference_h_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_longitude_difference_d_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_text_eot_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_eot_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_text_battery_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_battery_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_text_posAJour_layer));
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_posAJour_layer));
  // Make sure the time is displayed from the start
  handle_battery(battery_state_service_peek());
}

static void main_window_unload(Window *window) {
  
  tick_timer_service_unsubscribe();
  battery_state_service_unsubscribe();
  
  // Destroy TextLayer
  text_layer_destroy(s_date_layer);
  text_layer_destroy(s_time_layer);
  text_layer_destroy(s_gmtime_layer);
  text_layer_destroy(s_text_solar_layer);
  text_layer_destroy(s_solar_layer);
  text_layer_destroy(s_text_longitude_difference_layer);
  text_layer_destroy(s_longitude_difference_d_layer);
  text_layer_destroy(s_longitude_difference_h_layer);
  text_layer_destroy(s_text_eot_layer);
  text_layer_destroy(s_eot_layer);
  text_layer_destroy(s_text_battery_layer);
  text_layer_destroy(s_battery_layer);
  text_layer_destroy(s_text_posAJour_layer);
  text_layer_destroy(s_posAJour_layer);
  
}

static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  update_time();
}
  
static void init() {
  
  // lecture des valeurs sauvegardées si elle existent, sinon: valeur par defaut
  longitude      = persist_exists(AD_MEM_LONGITUDE) ?      persist_read_int(AD_MEM_LONGITUDE) :      VAL_DEFAUT_LONGITUDE;
  longitude      = longitude / 10000;
  timezoneOffset = persist_exists(AD_MEM_TIMEZONEOFFSET) ? persist_read_int(AD_MEM_TIMEZONEOFFSET) : VAL_DEFAUT_TIMEZONEOFFSET;
  time_zone      = persist_exists(AD_MEM_TIME_ZONE) ?      persist_read_int(AD_MEM_TIME_ZONE) :      VAL_DEFAUT_TIME_ZONE;
  corr_eotd      = persist_exists(AD_MEM_CORR_EOTD) ?      persist_read_int(AD_MEM_CORR_EOTD) :      VAL_DEFAUT_CORR_EOTD;
  corr_eotd      = corr_eotd / 100;
  lastTime       = persist_exists(AD_MEM_LASTTIME) ?       persist_read_int(AD_MEM_LASTTIME) :       VAL_DEFAUT_LASTTIME;

  
  app_message_register_inbox_received(in_received_handler);
  app_message_register_inbox_dropped(in_dropped_handler);
  app_message_register_outbox_sent(out_sent_handler);
  app_message_register_outbox_failed(out_failed_handler);
  
  app_message_open(app_message_inbox_size_maximum(),app_message_outbox_size_maximum());
  
  // Create main Window element and assign to pointer
  s_main_window = window_create();

  // Set handlers to manage the elements inside the Window
  window_set_window_handlers(s_main_window, (WindowHandlers) {
    .load = main_window_load,
    .unload = main_window_unload
  });

  // Show the Window on the watch, with animated=true
  window_stack_push(s_main_window, true);
  
  // Register with TickTimerService
 // tick_timer_service_subscribe(SECOND_UNIT, tick_handler);
  tick_timer_service_subscribe (MINUTE_UNIT, tick_handler);
  
  battery_state_service_subscribe(handle_battery);
  
}

static void deinit() {
  //sauvegarde des données
  if (longitude > -181 && longitude < 181 && timezoneOffset > (-15 * 3600) && timezoneOffset < (17 * 3600) && time_zone > (3600 * -12) && time_zone < (3600 * 14) && corr_eotd > -30 && corr_eotd < 30)
      {
        persist_write_int(AD_MEM_LONGITUDE, longitude*10000);
        persist_write_int(AD_MEM_TIMEZONEOFFSET, timezoneOffset);
        persist_write_int(AD_MEM_TIME_ZONE, time_zone);
        persist_write_int(AD_MEM_CORR_EOTD, corr_eotd*100);
        persist_write_int(AD_MEM_LASTTIME, lastTime);
      }
  // Destroy Window
  window_destroy(s_main_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
