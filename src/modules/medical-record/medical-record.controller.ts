import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { MedicalRecordService } from './medical-record.service';
import {
  CreateMedicalRecordDto,
  UpdateMedicalRecordDto,
  QueryMyMedicalRecordsDto,
  QueryAdminMedicalRecordsDto,
} from './dto/medical-record.dto';
import { Roles, CurrentUser } from '@modules/auth/decorators';
import { UserRole, AuthUser } from '@modules/auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────
//  DOCTOR Controller
//  - POST  /api/v1/medical-records          (tạo hồ sơ)
//  - PATCH /api/v1/medical-records/:id      (cập nhật)
//  - GET   /api/v1/doctors/me/medical-records (xem của mình)
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.DOCTOR)
@Controller('medical-records')
export class MedicalRecordDoctorController {
  constructor(
    private readonly medicalRecordService: MedicalRecordService,
  ) {}

  /**
   * POST /api/v1/medical-records
   * Bác sĩ tạo hồ sơ bệnh án sau khi appointment = completed.
   */
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMedicalRecordDto,
  ) {
    const data = await this.medicalRecordService.create(user.id, dto);
    return {
      message: 'Tạo hồ sơ bệnh án thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/medical-records/:id
   * Bác sĩ cập nhật hồ sơ bệnh án của mình.
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    const data = await this.medicalRecordService.update(user.id, id, dto);
    return {
      message: 'Cập nhật hồ sơ bệnh án thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  DOCTOR-ME Controller  →  /api/v1/doctors/me/medical-records
//  Bác sĩ xem danh sách hồ sơ mình đã tạo.
//  Tách prefix riêng để URL nhất quán với các /doctors/me/* khác.
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.DOCTOR)
@Controller('doctors/me/medical-records')
export class MedicalRecordDoctorMeController {
  constructor(
    private readonly medicalRecordService: MedicalRecordService,
  ) {}

  /**
   * GET /api/v1/doctors/me/medical-records?page=&limit=
   * Bác sĩ xem toàn bộ hồ sơ bệnh án mình đã tạo.
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryMyMedicalRecordsDto,
  ) {
    const result = await this.medicalRecordService.findByDoctor(
      user.id,
      query,
    );
    return {
      message: 'Lấy danh sách hồ sơ bệnh án thành công',
      ...result,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  USER Controller  →  /api/v1/users/me/medical-records
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.USER)
@Controller('users/me/medical-records')
export class MedicalRecordUserController {
  constructor(
    private readonly medicalRecordService: MedicalRecordService,
  ) {}

  /**
   * GET /api/v1/users/me/medical-records?page=&limit=
   * User xem toàn bộ hồ sơ bệnh án của tất cả patient profiles thuộc mình.
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryMyMedicalRecordsDto,
  ) {
    const result = await this.medicalRecordService.findByUser(user.id, query);
    return {
      message: 'Lấy danh sách hồ sơ bệnh án thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/users/me/medical-records/:id
   * User xem chi tiết 1 hồ sơ — ownership check.
   */
  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const data = await this.medicalRecordService.findOneByUser(user.id, id);
    return {
      message: 'Lấy thông tin hồ sơ bệnh án thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADMIN Controller  →  /api/v1/admin/medical-records
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.ADMIN)
@Controller('admin/medical-records')
export class MedicalRecordAdminController {
  constructor(
    private readonly medicalRecordService: MedicalRecordService,
  ) {}

  /**
   * GET /api/v1/admin/medical-records?patientProfileId=&doctorId=&page=&limit=
   * Admin xem tất cả hồ sơ bệnh án.
   */
  @Get()
  async findAll(@Query() query: QueryAdminMedicalRecordsDto) {
    const result = await this.medicalRecordService.adminFindAll(query);
    return {
      message: 'Lấy danh sách hồ sơ bệnh án thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/admin/medical-records/:id
   * Admin xem chi tiết bất kỳ hồ sơ bệnh án.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.medicalRecordService.adminFindById(id);
    return {
      message: 'Lấy thông tin hồ sơ bệnh án thành công',
      data,
    };
  }
}
