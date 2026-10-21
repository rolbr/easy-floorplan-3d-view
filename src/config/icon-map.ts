// Static icon mapping data for the icon resolver (device_class, domain, climate and weather icons)

export type IconEntry = string | { on: string; off: string };

export const DEVICE_CLASS_ICONS: Record<string, Record<string, IconEntry>> = {
  // -------------------------------------------------------------------
  // sensor (SensorDeviceClass) – plain read-only sensors
  // -------------------------------------------------------------------
  sensor: {
    absolute_humidity: 'mdi:water-percent',
    apparent_power: 'mdi:flash',
    aqi: 'mdi:air-filter',
    area: 'mdi:texture-box',
    atmospheric_pressure: 'mdi:thermometer-lines',
    battery: 'mdi:battery',
    blood_glucose_concentration: 'mdi:spoon-sugar',
    carbon_dioxide: 'mdi:molecule-co2',
    carbon_monoxide: 'mdi:molecule-co',
    current: 'mdi:current-ac',
    data_rate: 'mdi:gauge', //'mdi:transmission-tower',
    data_size: 'mdi:database',
    date: 'mdi:calendar',
    distance: 'mdi:arrow-left-right',
    duration: 'mdi:timer-outline',
    energy: 'mdi:lightning-bolt',
    energy_distance: 'mdi:lightning-bolt',
    energy_storage: 'mdi:battery-high',
    enum: 'mdi:format-list-bulleted',
    frequency: 'mdi:sine-wave',
    gas: 'mdi:meter-gas',
    humidity: 'mdi:water-percent',
    illuminance: 'mdi:brightness-5',
    irradiance: 'mdi:sun-wireless',
    moisture: 'mdi:water-percent',
    monetary: 'mdi:cash',
    nitrogen_dioxide: 'mdi:molecule',
    nitrogen_monoxide: 'mdi:molecule',
    nitrous_oxide: 'mdi:molecule',
    ozone: 'mdi:molecule',
    ph: 'mdi:ph',
    pm1: 'mdi:molecule',
    pm10: 'mdi:molecule',
    pm25: 'mdi:molecule',
    power: 'mdi:flash',
    power_factor: 'mdi:angle-acute',
    precipitation: 'mdi:weather-rainy',
    precipitation_intensity: 'mdi:weather-pouring',
    pressure: 'mdi:gauge',
    reactive_power: 'mdi:flash',
    signal_strength: 'mdi:wifi',
    sound_pressure: 'mdi:ear-hearing',
    speed: 'mdi:speedometer',
    sulphur_dioxide: 'mdi:molecule',
    temperature: 'mdi:thermometer',
    timestamp: 'mdi:clock',
    volatile_organic_compounds: 'mdi:molecule',
    volatile_organic_compounds_parts: 'mdi:molecule',
    voltage: 'mdi:sine-wave',
    volume: 'mdi:cup',
    volume_flow_rate: 'mdi:pipe',
    volume_storage: 'mdi:storage-tank',
    water: 'mdi:water',
    weight: 'mdi:weight',
    wind_direction: 'mdi:compass-outline',
    wind_speed: 'mdi:weather-windy',
  },

  // -------------------------------------------------------------------
  // binary_sensor (BinarySensorDeviceClass) – icon depends on on/off state
  // Stored here as { on, off }; resolveIcon() picks the matching one.
  // -------------------------------------------------------------------
  binary_sensor: {
    battery: { on: 'mdi:battery-alert', off: 'mdi:battery' },
    battery_charging: { on: 'mdi:battery-charging', off: 'mdi:battery' },
    co: { on: 'mdi:molecule-co', off: 'mdi:molecule-co' },
    cold: { on: 'mdi:snowflake', off: 'mdi:thermometer' },
    connectivity: { on: 'mdi:check-network', off: 'mdi:close-network' },
    door: { on: 'mdi:door-open', off: 'mdi:door-closed' },
    garage_door: { on: 'mdi:garage-open', off: 'mdi:garage' },
    gas: { on: 'mdi:alert', off: 'mdi:check-circle' },
    heat: { on: 'mdi:fire', off: 'mdi:thermometer' },
    light: { on: 'mdi:brightness-7', off: 'mdi:brightness-5' },
    lock: { on: 'mdi:lock-open-variant', off: 'mdi:lock' },
    moisture: { on: 'mdi:water-alert', off: 'mdi:water-off' },
    motion: { on: 'mdi:motion-sensor', off: 'mdi:motion-sensor-off' },
    moving: { on: 'mdi:arrow-right', off: 'mdi:stop' },
    occupancy: { on: 'mdi:home', off: 'mdi:home-outline' },
    opening: { on: 'mdi:door-open', off: 'mdi:door-closed' },
    plug: { on: 'mdi:power-plug', off: 'mdi:power-plug-off' },
    power: { on: 'mdi:power-plug', off: 'mdi:power-plug-off' },
    presence: { on: 'mdi:home', off: 'mdi:home-outline' },
    problem: { on: 'mdi:alert-circle', off: 'mdi:check-circle' },
    running: { on: 'mdi:play', off: 'mdi:stop' },
    safety: { on: 'mdi:alert-circle', off: 'mdi:check-circle' },
    smoke: {
      on: 'mdi:smoke-detector-variant-alert',
      off: 'mdi:smoke-detector-variant',
    },
    sound: { on: 'mdi:volume-high', off: 'mdi:volume-off' },
    tamper: { on: 'mdi:alert-circle', off: 'mdi:check-circle' },
    update: { on: 'mdi:package-up', off: 'mdi:package' },
    vibration: { on: 'mdi:vibrate', off: 'mdi:crop-portrait' },
    window: { on: 'mdi:window-open', off: 'mdi:window-closed' },
  },

  // -------------------------------------------------------------------
  // cover (CoverDeviceClass)
  // -------------------------------------------------------------------
  cover: {
    awning: { on: 'mdi:window-shutter-open', off: 'mdi:window-shutter' },
    blind: { on: 'mdi:blinds-open', off: 'mdi:blinds' },
    curtain: { on: 'mdi:curtains-closed', off: 'mdi:curtains' },
    damper: { on: 'mdi:circle', off: 'mdi:circle-slice-8' },
    door: { on: 'mdi:door-open', off: 'mdi:door-closed' },
    garage: { on: 'mdi:garage-open', off: 'mdi:garage' },
    gate: { on: 'mdi:gate-open', off: 'mdi:gate' },
    shade: { on: 'mdi:blinds-open', off: 'mdi:blinds' },
    shutter: { on: 'mdi:window-shutter-open', off: 'mdi:window-shutter' },
    window: { on: 'mdi:window-open', off: 'mdi:window-closed' },
  },

  // -------------------------------------------------------------------
  // switch (SwitchDeviceClass) – only 2 values
  // -------------------------------------------------------------------
  switch: {
    outlet: { on: 'mdi:power-plug', off: 'mdi:power-plug-off' },
    switch: { on: 'mdi:toggle-switch', off: 'mdi:toggle-switch-off' },
  },

  // -------------------------------------------------------------------
  // number / input_number (NumberDeviceClass) largely overlaps with SensorDeviceClass
  // -------------------------------------------------------------------
  number: {
    temperature: 'mdi:thermometer',
    humidity: 'mdi:water-percent',
    power: 'mdi:flash',
    energy: 'mdi:lightning-bolt',
    battery: 'mdi:battery',
    distance: 'mdi:arrow-left-right',
    pressure: 'mdi:gauge',
    volume: 'mdi:cup',
    weight: 'mdi:weight',
  },

  // -------------------------------------------------------------------
  // update (UpdateDeviceClass)
  // -------------------------------------------------------------------
  update: {
    firmware: 'mdi:chip',
  },

  // -------------------------------------------------------------------
  // event (EventDeviceClass)
  // -------------------------------------------------------------------
  event: {
    button: 'mdi:gesture-tap-button',
    doorbell: 'mdi:doorbell',
    motion: 'mdi:motion-sensor',
  },

  // -------------------------------------------------------------------
  // valve (ValveDeviceClass)
  // -------------------------------------------------------------------
  valve: {
    water: { on: 'mdi:valve-open', off: 'mdi:valve-closed' },
    gas: { on: 'mdi:valve-open', off: 'mdi:valve-closed' },
  },

  // -------------------------------------------------------------------
  // humidifier (HumidifierDeviceClass)
  // -------------------------------------------------------------------
  humidifier: {
    humidifier: 'mdi:air-humidifier',
    dehumidifier: 'mdi:air-humidifier-off',
  },
};

// ---------------------------------------------------------------------------
// 2) Domain fallback: used when NO device_class is set (e.g. climate, light, media_player)
//    or the domain doesn't have the device_class concept at all.
//    Where it makes sense, stored as { on, off } for state-dependent icons.
// ---------------------------------------------------------------------------

export const DOMAIN_FALLBACK_ICONS: Record<string, IconEntry> = {
  air_quality: 'mdi:air-filter',
  alarm_control_panel: { on: 'mdi:shield-lock', off: 'mdi:shield-off' },
  automation: { on: 'mdi:robot', off: 'mdi:robot-off' },
  binary_sensor: {
    on: 'mdi:checkbox-marked-circle',
    off: 'mdi:checkbox-blank-circle-outline',
  },
  button: 'mdi:gesture-tap-button',
  calendar: 'mdi:calendar',
  camera: 'mdi:camera',
  climate: 'mdi:thermostat',
  cover: { on: 'mdi:blinds-open', off: 'mdi:blinds' },
  device_tracker: 'mdi:account',
  fan: { on: 'mdi:fan', off: 'mdi:fan-off' },
  humidifier: { on: 'mdi:air-humidifier', off: 'mdi:air-humidifier-off' },
  input_boolean: { on: 'mdi:toggle-switch', off: 'mdi:toggle-switch-off' },
  input_button: 'mdi:gesture-tap-button',
  input_datetime: 'mdi:calendar-clock',
  input_number: 'mdi:ray-vertex',
  input_select: 'mdi:format-list-bulleted',
  input_text: 'mdi:form-textbox',
  light: { on: 'mdi:lightbulb-on', off: 'mdi:lightbulb-outline' }, // { on: 'mdi:lightbulb', off: 'mdi:lightbulb-off' }
  lock: { on: 'mdi:lock-open-variant', off: 'mdi:lock' },
  media_player: 'mdi:cast',
  number: 'mdi:ray-vertex',
  person: 'mdi:account',
  remote: 'mdi:remote',
  scene: 'mdi:palette',
  script: 'mdi:script-text',
  select: 'mdi:format-list-bulleted',
  sensor: 'mdi:eye',
  siren: { on: 'mdi:bullhorn', off: 'mdi:bullhorn-outline' },
  sun: 'mdi:white-balance-sunny',
  switch: { on: 'mdi:toggle-switch', off: 'mdi:toggle-switch-off-outline' }, // { on: 'mdi:toggle-switch', off: 'mdi:toggle-switch-off' },
  text: 'mdi:form-textbox',
  timer: 'mdi:timer-outline',
  todo: 'mdi:clipboard-list',
  update: 'mdi:package',
  vacuum: 'mdi:robot-vacuum',
  valve: { on: 'mdi:valve-open', off: 'mdi:valve-closed' },
  water_heater: 'mdi:water-boiler',
  weather: 'mdi:weather-cloudy',
  zone: 'mdi:map-marker-radius',
};

export const FINAL_FALLBACK_ICON = 'mdi:help-circle';

// ---------------------------------------------------------------------------
// 2b) Special cases: domains without device_class, but with their own
//     state logic. These are deliberately NOT device_class mappings
//     (climate/weather barely use the device_class concept at all), but
//     plain state maps, because the icon here depends on the operating
//     state rather than a device categorization.
// ---------------------------------------------------------------------------

/**
 * climate: HA's frontend looks primarily at hvac_action (what the unit is CURRENTLY DOING),
 * not at hvac_mode (what is configured). If hvac_action is missing, hvac_mode is used instead.
 */
// const CLIMATE_ICONS = {
//   // hvac_action (preferred)
//   off: 'mdi:thermostat-off',
//   idle: 'mdi:thermostat',
//   heating: 'mdi:fire',
//   cooling: 'mdi:snowflake',
//   drying: 'mdi:water-percent',
//   fan: 'mdi:fan',
//   defrosting: 'mdi:snowflake-melt',
//   preheating: 'mdi:radiator',

//   // hvac_mode (fallback if hvac_action is missing)
//   heat: 'mdi:fire',
//   cool: 'mdi:snowflake',
//   heat_cool: 'mdi:sun-snowflake-variant',
//   auto: 'mdi:thermostat-auto',
//   dry: 'mdi:water-percent',
//   fan_only: 'mdi:fan',
// };
/**
 * climate: icon follows the configured hvac_mode (the entity state), not hvac_action.
 * Unknown modes fall through to the domain fallback (mdi:thermostat).
 */
export const CLIMATE_ICONS: Record<string, string> = {
  off: 'mdi:thermostat',
  heat: 'mdi:fire',
  cool: 'mdi:snowflake',
  auto: 'mdi:thermostat-auto',
};

/**
 * weather: icon follows the state of the weather entity 1:1.
 * Complete, official list of weather states supported by HA
 * (see developers.home-assistant.io/docs/core/entity/weather).
 */
export const WEATHER_ICONS: Record<string, string> = {
  'clear-night': 'mdi:weather-night',
  cloudy: 'mdi:weather-cloudy',
  exceptional: 'mdi:alert-circle-outline',
  fog: 'mdi:weather-fog',
  hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning',
  'lightning-rainy': 'mdi:weather-lightning-rainy',
  partlycloudy: 'mdi:weather-partly-cloudy',
  pouring: 'mdi:weather-pouring',
  rainy: 'mdi:weather-rainy',
  snowy: 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy',
  sunny: 'mdi:weather-sunny',
  windy: 'mdi:weather-windy',
  'windy-variant': 'mdi:weather-windy-variant',
};
