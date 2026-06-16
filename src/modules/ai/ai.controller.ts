import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '@modules/auth/decorators';
import { AiService } from './ai.service';
import { TriageDto } from './dto/triage.dto';

@Public()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('triage')
  async triage(@Body() dto: TriageDto) {
    const data = await this.aiService.triage(dto.message);
    return {
      message: 'Gợi ý chuyên khoa thành công',
      data,
    };
  }
}
