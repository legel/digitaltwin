/**
 * @license
 * Cesium - https://github.com/CesiumGS/cesium
 * Version 1.131
 *
 * Copyright 2011-2022 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/CesiumGS/cesium/blob/main/LICENSE.md for full licensing details.
 */

import {
  EllipseGeometry_default
} from "./chunk-MH7ZQIUZ.js";
import "./chunk-PEABICEF.js";
import "./chunk-SAF4QVHT.js";
import "./chunk-66VIJ6PI.js";
import "./chunk-DAVJBHPZ.js";
import "./chunk-5XFVDDJR.js";
import "./chunk-SWKOJLGC.js";
import "./chunk-B6GSSTOR.js";
import "./chunk-2Z52SAE7.js";
import "./chunk-GLQFJBNC.js";
import "./chunk-D5FQVTOA.js";
import "./chunk-ZY2NL42U.js";
import "./chunk-6PF2YMI3.js";
import "./chunk-3QBNEPT3.js";
import "./chunk-OJENRE7O.js";
import "./chunk-IZN72LSC.js";
import {
  Cartesian3_default,
  Ellipsoid_default
} from "./chunk-NF5SG3CI.js";
import "./chunk-PWWSKAPB.js";
import "./chunk-2DV2K5ZE.js";
import "./chunk-XESAYCGT.js";
import "./chunk-HGPEZFC4.js";
import {
  defined_default
} from "./chunk-HGSHOKKT.js";

// packages/engine/Source/Workers/createEllipseGeometry.js
function createEllipseGeometry(ellipseGeometry, offset) {
  if (defined_default(offset)) {
    ellipseGeometry = EllipseGeometry_default.unpack(ellipseGeometry, offset);
  }
  ellipseGeometry._center = Cartesian3_default.clone(ellipseGeometry._center);
  ellipseGeometry._ellipsoid = Ellipsoid_default.clone(ellipseGeometry._ellipsoid);
  return EllipseGeometry_default.createGeometry(ellipseGeometry);
}
var createEllipseGeometry_default = createEllipseGeometry;
export {
  createEllipseGeometry_default as default
};
