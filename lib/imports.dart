

//------------------------------------------------------------------------------
// Framework imports
//------------------------------------------------------------------------------

export 'package:flutter/material.dart';
export 'package:flutter/services.dart';
export 'package:flutter/foundation.dart';

//------------------------------------------------------------------------------
// Authentication & Data Imports
//------------------------------------------------------------------------------

export 'firebase_options.dart';
export 'package:firebase_core/firebase_core.dart';
export 'package:firebase_auth/firebase_auth.dart';

export 'data/models/project_model.dart';
export 'data/repositories/projects_repository.dart';
export 'data/providers/project_selected_provider.dart';

//------------------------------------------------------------------------------
// Service Imports
//------------------------------------------------------------------------------

export 'services/auth_service.dart';
export 'services/app_text_service.dart';
export 'services/constants_service.dart';
export 'services/url_service.dart';
export 'routes.dart';

//------------------------------------------------------------------------------
// Design Packages & Imports
//------------------------------------------------------------------------------

export 'package:google_fonts/google_fonts.dart';

//------------------------------------------------------------------------------
// Screen Imports
//------------------------------------------------------------------------------

export 'screens/authentication/login_screen.dart';
export 'screens/dashboard/dashboard_screen.dart';
export 'screens/dashboard/home_tab/home_tab_screen.dart';
export 'screens/dashboard/reports_tab/reports_tab_screen.dart';
export 'screens/dashboard/spending_tab/spending_tab_screen.dart';
export 'screens/authentication/user_registration_form.dart';



//------------------------------------------------------------------------------
// Widget Imports
//------------------------------------------------------------------------------

export 'widgets/screen_normal_appbar.dart';
export 'widgets/current_user_tile.dart';
export 'widgets/project_detail_widget.dart';