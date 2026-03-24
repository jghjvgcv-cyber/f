import { User } from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export interface DriverData {
  id: string;
  name: string;
  code: string;
  plate: string;
  vehicle: string;
  uid: string;
  phone?: string;
  photoURL?: string;
  vehicleStatus: 'operational' | 'maintenance_required' | 'out_of_service';
}

export interface ShiftData {
  id: string;
  driverId: string;
  startTime: any;
  endTime?: any;
  quilometragem_inicial?: number;
  quilometragem_final?: number;
  total_entregas?: number;
  targetDeliveries?: number;
  status: 'active' | 'completed';
  date: string;
  orderNumbers?: string[];
}

export interface HelpRequest {
  id: string;
  driverId: string;
  message: string;
  status: 'pending' | 'resolved';
  timestamp: any;
}

export interface Message {
  id?: string;
  driverId: string;
  senderId: string;
  text?: string;
  photo?: string;
  audio?: string;
  timestamp: any;
}

export interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  timestamp: any;
  status: string;
}

export interface DriverProfile {
  id: string;
  name: string;
  code: string;
  plate: string;
  vehicle: string;
  phone?: string;
  email?: string;
}
